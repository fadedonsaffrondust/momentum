import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { brands, brandStakeholders, brandMeetings, brandActionItems } from '@momentum/db';
import type { BrandStatus } from '@momentum/shared';
import type { Tool, ToolContext } from './types.ts';

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
