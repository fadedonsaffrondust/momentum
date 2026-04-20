import { z } from 'zod';
import { and, desc, eq, lt } from 'drizzle-orm';
import { brandActionItems } from '@momentum/db';
import type { BrandActionStatus } from '@momentum/shared';
import { isoDateSchema } from '@momentum/shared';
import type { Tool } from './types.ts';

/**
 * Cross-brand action-item tools. Brand-scoped variant lives on
 * `tools/brands.ts` (`getBrandActionItems`) because it shares the same
 * query + serialization machinery; these two are the cross-cutting
 * queries the LLM needs when the user isn't thinking about a specific
 * brand ("what's on my plate", "what's overdue").
 */

export interface ActionItemSummary {
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

function serializeRow(r: typeof brandActionItems.$inferSelect): ActionItemSummary {
  return {
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
  };
}

/* ─────────────── getActionItems ─────────────── */

const getActionItemsInputSchema = z.object({
  assigneeId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum(['open', 'done']).optional(),
  dueBefore: isoDateSchema
    .optional()
    .describe(
      'ISO date (YYYY-MM-DD). Returns action items whose due_date is strictly before this date.',
    ),
  limit: z.number().int().min(1).max(200).default(100),
});

export type GetActionItemsInput = z.infer<typeof getActionItemsInputSchema>;
export type GetActionItemsOutput = ActionItemSummary[];

export const getActionItems: Tool<GetActionItemsInput, GetActionItemsOutput> = {
  name: 'getActionItems',
  description: [
    'Use when the user asks about action items across brands — "what\'s on Sara\'s plate", "show me everything that\'s open and due this week", "what action items came out of the Chipotle thread".',
    'Returns action items filtered by any combination of assignee, brand, status, and due-before cutoff. Newest first.',
    "Do not use for a single brand's items (prefer getBrandActionItems — specific tools are cheaper) or just-overdue filter (prefer getOverdueActionItems — drops the assignee-required boilerplate).",
  ].join(' '),
  inputSchema: getActionItemsInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const conditions = [];
    if (args.assigneeId) conditions.push(eq(brandActionItems.assigneeId, args.assigneeId));
    if (args.brandId) conditions.push(eq(brandActionItems.brandId, args.brandId));
    if (args.status) conditions.push(eq(brandActionItems.status, args.status));
    if (args.dueBefore) conditions.push(lt(brandActionItems.dueDate, args.dueBefore));

    const base = ctx.db.select().from(brandActionItems);
    const q = conditions.length > 0 ? base.where(and(...conditions)) : base;
    const rows = await q.orderBy(desc(brandActionItems.createdAt)).limit(args.limit);
    return rows.map(serializeRow);
  },
};

/* ─────────────── getOverdueActionItems ─────────────── */

const getOverdueActionItemsInputSchema = z.object({
  assigneeId: z
    .string()
    .uuid()
    .optional()
    .describe('Scope to a specific team member. Omit to return the full team overdue list.'),
  limit: z.number().int().min(1).max(200).default(100),
});

export type GetOverdueActionItemsInput = z.infer<typeof getOverdueActionItemsInputSchema>;
export type GetOverdueActionItemsOutput = ActionItemSummary[];

export const getOverdueActionItems: Tool<GetOverdueActionItemsInput, GetOverdueActionItemsOutput> =
  {
    name: 'getOverdueActionItems',
    description: [
      'Use when the user asks what\'s overdue — "what\'s overdue right now", "what has Sara dropped".',
      'Returns open action items with a due_date strictly before today (server-computed from ctx.now), sorted due-date ascending so the oldest surfaces first. Optionally scoped to one assignee.',
      'Do not use for an arbitrary due-before cutoff (use getActionItems with dueBefore) — this tool always uses today.',
    ].join(' '),
    inputSchema: getOverdueActionItemsInputSchema,
    readOnly: true,
    async handler(args, ctx) {
      const today = toDateOnly(ctx.now);
      const conditions = [
        eq(brandActionItems.status, 'open' as const),
        lt(brandActionItems.dueDate, today),
      ];
      if (args.assigneeId) conditions.push(eq(brandActionItems.assigneeId, args.assigneeId));

      const rows = await ctx.db
        .select()
        .from(brandActionItems)
        .where(and(...conditions))
        .orderBy(brandActionItems.dueDate)
        .limit(args.limit);
      return rows.map(serializeRow);
    },
  };

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
