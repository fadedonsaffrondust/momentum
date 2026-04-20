import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { brands, brandMeetings, brandActionItems, brandEvents } from '@momentum/db';
import type { BrandStatus } from '@momentum/shared';
import type { Tool, ToolContext } from './types.ts';

/* ─────────────── getBrandsRequiringAttention ─────────────── */
//
// One of the few tools that does meaningful computation server-side. The
// LLM should not be asked to do this math from raw rows — it's slow and
// hallucination-prone. The scoring formula is deliberately simple and
// documented in both the code and the tool's return payload so the user
// can see why a brand ranked where it did.
//
// score =   10 * overdueActionItems            (each overdue item is costly)
//         +  2 * openActionItems               (backlog tax)
//         +  1 * min(daysSinceLastMeeting, 60) (staleness of live touch)
//         + 0.5 * min(daysSinceLastEvent,   60) (staleness of any activity)
//
// The 60-day cap prevents a long-abandoned brand from dominating the list
// purely on staleness; it also means new brands with no meetings yet don't
// mechanically outscore brands in active trouble.

const DAYS_CAP = 60;
const WEIGHT_OVERDUE = 10;
const WEIGHT_OPEN = 2;
const WEIGHT_STALE_MEETING = 1;
const WEIGHT_STALE_EVENT = 0.5;
const DEFAULT_LIMIT = 20;

const SCORING_FORMULA =
  `score = ${WEIGHT_OVERDUE} * overdueActionItems + ${WEIGHT_OPEN} * openActionItems ` +
  `+ ${WEIGHT_STALE_MEETING} * min(daysSinceLastMeeting, ${DAYS_CAP}) ` +
  `+ ${WEIGHT_STALE_EVENT} * min(daysSinceLastEvent, ${DAYS_CAP})`;

const getBrandsRequiringAttentionInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(DEFAULT_LIMIT)
    .describe('Maximum number of brands to return. Default 20, max 50.'),
});

export type GetBrandsRequiringAttentionInput = z.infer<
  typeof getBrandsRequiringAttentionInputSchema
>;

export interface GetBrandsRequiringAttentionOutput {
  scoringFormula: string;
  brands: Array<{
    id: string;
    name: string;
    status: BrandStatus;
    attentionScore: number;
    reasons: string[];
    signals: {
      overdueActionItems: number;
      openActionItems: number;
      daysSinceLastMeeting: number | null;
      daysSinceLastEvent: number | null;
    };
  }>;
}

export const getBrandsRequiringAttention: Tool<
  GetBrandsRequiringAttentionInput,
  GetBrandsRequiringAttentionOutput
> = {
  name: 'getBrandsRequiringAttention',
  description: [
    'Use when the user asks which brands need attention, are falling behind, are going dark, or are at risk — "what brand should I focus on", "which accounts are slipping", "who needs help this week".',
    'Returns a ranked list of active brands with an attentionScore (higher = more attention needed), human-readable reasons (e.g. "3 overdue action items", "21 days since last meeting"), and the raw signals used for scoring. The formula is server-computed and included in the payload so the user can see why a brand ranked where it did.',
    'Do not use for a detailed look at one specific brand (use getBrand) or for listing brands unfiltered (use getBrands).',
  ].join(' '),
  inputSchema: getBrandsRequiringAttentionInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const todayIso = toDateOnly(ctx.now);

    // Four small aggregation queries. Combined in memory; fine at any brand
    // count Omnirev realistically has. Swap for a single CTE if needed.
    const [activeBrands, actionItemStats, lastMeetings, lastEvents] = await Promise.all([
      ctx.db
        .select({
          id: brands.id,
          name: brands.name,
          status: brands.status,
        })
        .from(brands)
        .where(eq(brands.status, 'active')),
      ctx.db
        .select({
          brandId: brandActionItems.brandId,
          openCount: sql<number>`count(*) filter (where ${brandActionItems.status} = 'open')::int`,
          overdueCount: sql<number>`count(*) filter (where ${brandActionItems.status} = 'open' and ${brandActionItems.dueDate} is not null and ${brandActionItems.dueDate} < ${todayIso})::int`,
        })
        .from(brandActionItems)
        .groupBy(brandActionItems.brandId),
      ctx.db
        .select({
          brandId: brandMeetings.brandId,
          lastDate: sql<string>`max(${brandMeetings.date})`,
        })
        .from(brandMeetings)
        .groupBy(brandMeetings.brandId),
      ctx.db
        .select({
          brandId: brandEvents.brandId,
          lastCreatedAt: sql<Date>`max(${brandEvents.createdAt})`,
        })
        .from(brandEvents)
        .groupBy(brandEvents.brandId),
    ]);

    type ItemStat = { openCount: number; overdueCount: number };
    const itemStatsByBrand = new Map<string, ItemStat>();
    for (const row of actionItemStats) {
      itemStatsByBrand.set(row.brandId, {
        openCount: Number(row.openCount),
        overdueCount: Number(row.overdueCount),
      });
    }

    const lastMeetingByBrand = new Map<string, string>();
    for (const row of lastMeetings) {
      if (row.lastDate) lastMeetingByBrand.set(row.brandId, row.lastDate);
    }

    const lastEventByBrand = new Map<string, Date>();
    for (const row of lastEvents) {
      if (row.lastCreatedAt) lastEventByBrand.set(row.brandId, new Date(row.lastCreatedAt));
    }

    const ranked = activeBrands.map((brand) => {
      const items = itemStatsByBrand.get(brand.id) ?? { openCount: 0, overdueCount: 0 };

      const lastMeetingIso = lastMeetingByBrand.get(brand.id) ?? null;
      const lastEvent = lastEventByBrand.get(brand.id) ?? null;
      const daysSinceLastMeeting = lastMeetingIso
        ? daysBetween(parseDateOnly(lastMeetingIso), ctx.now)
        : null;
      const daysSinceLastEvent = lastEvent ? daysBetween(lastEvent, ctx.now) : null;

      const staleMeetingDays = daysSinceLastMeeting ?? DAYS_CAP;
      const staleEventDays = daysSinceLastEvent ?? DAYS_CAP;

      const score =
        WEIGHT_OVERDUE * items.overdueCount +
        WEIGHT_OPEN * items.openCount +
        WEIGHT_STALE_MEETING * Math.min(staleMeetingDays, DAYS_CAP) +
        WEIGHT_STALE_EVENT * Math.min(staleEventDays, DAYS_CAP);

      const reasons = buildReasons({
        overdueCount: items.overdueCount,
        openCount: items.openCount,
        daysSinceLastMeeting,
        daysSinceLastEvent,
      });

      return {
        id: brand.id,
        name: brand.name,
        status: brand.status,
        attentionScore: roundToOneDecimal(score),
        reasons,
        signals: {
          overdueActionItems: items.overdueCount,
          openActionItems: items.openCount,
          daysSinceLastMeeting,
          daysSinceLastEvent,
        },
      };
    });

    ranked.sort((a, b) => b.attentionScore - a.attentionScore);

    return {
      scoringFormula: SCORING_FORMULA,
      brands: ranked.slice(0, args.limit),
    };
  },
};

function buildReasons(input: {
  overdueCount: number;
  openCount: number;
  daysSinceLastMeeting: number | null;
  daysSinceLastEvent: number | null;
}): string[] {
  const reasons: string[] = [];
  if (input.overdueCount > 0) {
    reasons.push(`${input.overdueCount} overdue action item${input.overdueCount === 1 ? '' : 's'}`);
  }
  if (input.openCount > 5) {
    reasons.push(`${input.openCount} open action items`);
  }
  if (input.daysSinceLastMeeting === null) {
    reasons.push('No meetings recorded');
  } else if (input.daysSinceLastMeeting > 14) {
    reasons.push(`${input.daysSinceLastMeeting} days since last meeting`);
  }
  if (input.daysSinceLastEvent === null) {
    reasons.push('No recorded activity');
  } else if (input.daysSinceLastEvent > 21) {
    reasons.push(`${input.daysSinceLastEvent} days since last activity`);
  }
  return reasons;
}

/** Floor-based day diff between two UTC dates. */
function daysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Formats a Date as YYYY-MM-DD (UTC). */
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parses YYYY-MM-DD to a Date at 00:00:00 UTC. */
function parseDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
