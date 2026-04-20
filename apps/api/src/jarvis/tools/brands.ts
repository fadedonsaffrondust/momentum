import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  brands,
  brandStakeholders,
  brandMeetings,
  brandActionItems,
  brandEvents,
} from '@momentum/db';
import type { BrandActionStatus, BrandStatus, MeetingSource } from '@momentum/shared';
import { isoDateSchema } from '@momentum/shared';
import type { Tool } from './types.ts';

/* ─────────────── getBrand ─────────────── */

const getBrandInputSchema = z.object({
  brandId: z
    .string()
    .uuid()
    .describe(
      'The UUID of the brand. Resolve names to IDs from the Brand Portfolio in the system prompt.',
    ),
});

export type GetBrandInput = z.infer<typeof getBrandInputSchema>;

export interface GetBrandOutput {
  id: string;
  name: string;
  goals: string | null;
  successDefinition: string | null;
  status: BrandStatus;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  stakeholders: Array<{
    id: string;
    name: string;
    email: string | null;
    role: string | null;
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    date: string;
    source: 'manual' | 'recording_sync';
    summary: string | null;
  }>;
  actionItemCounts: {
    open: number;
    done: number;
  };
}

const RECENT_MEETINGS_LIMIT = 5;

export const getBrand: Tool<GetBrandInput, GetBrandOutput | null> = {
  name: 'getBrand',
  description: [
    'Use when the user asks about a specific brand by ID or name — "how is Boudin doing", "what\'s the status on Chipotle", "summarize brand X".',
    "Returns the brand's core fields (id, name, goals, success definition, status, custom fields) plus its stakeholders, the 5 most recent meetings, and open/done action item counts. Returns null if the brand does not exist.",
    'Do not use for listing brands generally (use getBrands) or the question "which brand needs the most attention" (use getBrandsRequiringAttention).',
    'Prefer resolving brand names to IDs from the Brand Portfolio inlined in the system prompt rather than a separate lookup tool call.',
  ].join(' '),
  inputSchema: getBrandInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const brandRows = await ctx.db
      .select()
      .from(brands)
      .where(eq(brands.id, args.brandId))
      .limit(1);

    const brand = brandRows[0];
    if (!brand) return null;

    const [stakeholders, recentMeetings, actionItemStats] = await Promise.all([
      ctx.db
        .select({
          id: brandStakeholders.id,
          name: brandStakeholders.name,
          email: brandStakeholders.email,
          role: brandStakeholders.role,
        })
        .from(brandStakeholders)
        .where(eq(brandStakeholders.brandId, args.brandId)),
      ctx.db
        .select({
          id: brandMeetings.id,
          title: brandMeetings.title,
          date: brandMeetings.date,
          source: brandMeetings.source,
          summary: brandMeetings.summary,
        })
        .from(brandMeetings)
        .where(eq(brandMeetings.brandId, args.brandId))
        .orderBy(desc(brandMeetings.date))
        .limit(RECENT_MEETINGS_LIMIT),
      ctx.db
        .select({
          status: brandActionItems.status,
          count: sql<number>`count(*)::int`,
        })
        .from(brandActionItems)
        .where(eq(brandActionItems.brandId, args.brandId))
        .groupBy(brandActionItems.status),
    ]);

    const actionItemCounts = { open: 0, done: 0 };
    for (const row of actionItemStats) {
      if (row.status === 'open') actionItemCounts.open = Number(row.count);
      if (row.status === 'done') actionItemCounts.done = Number(row.count);
    }

    return {
      id: brand.id,
      name: brand.name,
      goals: brand.goals,
      successDefinition: brand.successDefinition,
      status: brand.status,
      customFields: (brand.customFields ?? {}) as Record<string, unknown>,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
      stakeholders,
      recentMeetings,
      actionItemCounts,
    };
  },
};

/* ─────────────── getBrands ─────────────── */

const getBrandsInputSchema = z.object({
  status: z.enum(['active', 'importing', 'import_failed']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type GetBrandsInput = z.infer<typeof getBrandsInputSchema>;

export interface BrandListEntry {
  id: string;
  name: string;
  status: BrandStatus;
  goals: string | null;
  successDefinition: string | null;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp of the most recent brand_event for this brand, or null. */
  lastActivityAt: string | null;
  openActionItemCount: number;
}

export type GetBrandsOutput = BrandListEntry[];

export const getBrands: Tool<GetBrandsInput, GetBrandsOutput> = {
  name: 'getBrands',
  description: [
    'Use when the user asks for a list of brands, optionally filtered by status — "show me our active brands", "which brands are still importing".',
    'Returns each brand with core fields, last-activity timestamp (max brand_events.created_at), and open action-item count. Intended for browsing; a detailed look at one brand uses getBrand.',
    'Do not use for "which brand needs attention" — use getBrandsRequiringAttention, which ranks them by a composite score.',
  ].join(' '),
  inputSchema: getBrandsInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const where = args.status ? eq(brands.status, args.status) : undefined;
    const base = ctx.db
      .select({
        id: brands.id,
        name: brands.name,
        status: brands.status,
        goals: brands.goals,
        successDefinition: brands.successDefinition,
        createdAt: brands.createdAt,
        updatedAt: brands.updatedAt,
      })
      .from(brands);
    const q = where ? base.where(where) : base;
    const brandRows = await q.orderBy(desc(brands.updatedAt)).limit(args.limit);
    if (brandRows.length === 0) return [];

    // Last-activity + open-count per brand. Two aggregation queries; keep it
    // simple and join in memory.
    const [activity, actionItems] = await Promise.all([
      ctx.db
        .select({
          brandId: brandEvents.brandId,
          lastCreatedAt: sql<Date>`max(${brandEvents.createdAt})`,
        })
        .from(brandEvents)
        .groupBy(brandEvents.brandId),
      ctx.db
        .select({
          brandId: brandActionItems.brandId,
          openCount: sql<number>`count(*) filter (where ${brandActionItems.status} = 'open')::int`,
        })
        .from(brandActionItems)
        .groupBy(brandActionItems.brandId),
    ]);

    const lastActivityByBrand = new Map<string, Date>();
    for (const row of activity) {
      if (row.lastCreatedAt) lastActivityByBrand.set(row.brandId, new Date(row.lastCreatedAt));
    }
    const openCountByBrand = new Map<string, number>();
    for (const row of actionItems) {
      openCountByBrand.set(row.brandId, Number(row.openCount));
    }

    return brandRows.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      goals: b.goals,
      successDefinition: b.successDefinition,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      lastActivityAt: lastActivityByBrand.get(b.id)?.toISOString() ?? null,
      openActionItemCount: openCountByBrand.get(b.id) ?? 0,
    }));
  },
};

/* ─────────────── getBrandActionItems ─────────────── */

const getBrandActionItemsInputSchema = z.object({
  brandId: z.string().uuid(),
  status: z.enum(['open', 'done']).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

export type GetBrandActionItemsInput = z.infer<typeof getBrandActionItemsInputSchema>;

export interface BrandActionItemSummary {
  id: string;
  brandId: string;
  meetingId: string | null;
  creatorId: string;
  assigneeId: string | null;
  text: string;
  status: BrandActionStatus;
  owner: string | null;
  dueDate: string | null;
  linkedTaskId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type GetBrandActionItemsOutput = BrandActionItemSummary[];

export const getBrandActionItems: Tool<GetBrandActionItemsInput, GetBrandActionItemsOutput> = {
  name: 'getBrandActionItems',
  description: [
    'Use when the user asks about action items on a specific brand — "what are the open items on Boudin", "what did we commit to on last week\'s call".',
    'Returns action items for a brand, optionally filtered by status (open | done). Each item includes text, owner, assignee, due date, and linked task.',
    'Do not use for cross-brand action-item queries (use getActionItems) or for just the overdue ones across assignees (use getOverdueActionItems).',
  ].join(' '),
  inputSchema: getBrandActionItemsInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const conditions = [eq(brandActionItems.brandId, args.brandId)];
    if (args.status) conditions.push(eq(brandActionItems.status, args.status));

    const rows = await ctx.db
      .select()
      .from(brandActionItems)
      .where(and(...conditions))
      .orderBy(desc(brandActionItems.createdAt))
      .limit(args.limit);

    return rows.map((r) => ({
      id: r.id,
      brandId: r.brandId,
      meetingId: r.meetingId,
      creatorId: r.creatorId,
      assigneeId: r.assigneeId,
      text: r.text,
      status: r.status,
      owner: r.owner,
      dueDate: r.dueDate,
      linkedTaskId: r.linkedTaskId,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }));
  },
};

/* ─────────────── getBrandMeetings ─────────────── */

const getBrandMeetingsInputSchema = z.object({
  brandId: z.string().uuid(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export type GetBrandMeetingsInput = z.infer<typeof getBrandMeetingsInputSchema>;

export interface BrandMeetingSummary {
  id: string;
  brandId: string;
  title: string;
  date: string;
  attendees: string[];
  source: MeetingSource;
  summary: string | null;
  decisions: string[];
  externalMeetingId: string | null;
  recordingUrl: string | null;
  createdAt: string;
}

export type GetBrandMeetingsOutput = BrandMeetingSummary[];

export const getBrandMeetings: Tool<GetBrandMeetingsInput, GetBrandMeetingsOutput> = {
  name: 'getBrandMeetings',
  description: [
    'Use when the user asks about meetings for a specific brand — "list Boudin\'s recent calls", "what did we discuss on our last Chipotle meeting".',
    'Returns meetings for the brand newest-first, optionally filtered by date range. Summary + decisions are included; full raw notes are only on getMeeting.',
    'Do not use for the most recent meetings across ALL brands (use getRecentMeetings) or for the full transcript of one meeting (use getMeeting).',
  ].join(' '),
  inputSchema: getBrandMeetingsInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const conditions = [eq(brandMeetings.brandId, args.brandId)];
    if (args.dateFrom) conditions.push(gte(brandMeetings.date, args.dateFrom));
    if (args.dateTo) conditions.push(lte(brandMeetings.date, args.dateTo));

    const rows = await ctx.db
      .select({
        id: brandMeetings.id,
        brandId: brandMeetings.brandId,
        title: brandMeetings.title,
        date: brandMeetings.date,
        attendees: brandMeetings.attendees,
        source: brandMeetings.source,
        summary: brandMeetings.summary,
        decisions: brandMeetings.decisions,
        externalMeetingId: brandMeetings.externalMeetingId,
        recordingUrl: brandMeetings.recordingUrl,
        createdAt: brandMeetings.createdAt,
      })
      .from(brandMeetings)
      .where(and(...conditions))
      .orderBy(desc(brandMeetings.date))
      .limit(args.limit);

    return rows.map((r) => ({
      id: r.id,
      brandId: r.brandId,
      title: r.title,
      date: r.date,
      attendees: r.attendees,
      source: r.source,
      summary: r.summary,
      decisions: r.decisions,
      externalMeetingId: r.externalMeetingId,
      recordingUrl: r.recordingUrl,
      createdAt: r.createdAt.toISOString(),
    }));
  },
};
