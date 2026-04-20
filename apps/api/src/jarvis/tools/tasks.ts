import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { brandActionItems, tasks } from '@momentum/db';
import type { Task } from '@momentum/shared';
import { isoDateSchema } from '@momentum/shared';
import type { Tool } from './types.ts';

/* ─────────────── getMyTasks ─────────────── */

const getMyTasksInputSchema = z.object({
  status: z
    .enum(['todo', 'in_progress', 'done'])
    .optional()
    .describe('Filter by task status. Omit to include all statuses.'),
  dateFrom: isoDateSchema
    .optional()
    .describe('ISO date (YYYY-MM-DD). Returns tasks scheduled on or after this date.'),
  dateTo: isoDateSchema
    .optional()
    .describe('ISO date (YYYY-MM-DD). Returns tasks scheduled on or before this date.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum number of tasks to return. Default 50, max 100.'),
});

export type GetMyTasksInput = z.infer<typeof getMyTasksInputSchema>;
export type GetMyTasksOutput = Omit<Task, 'description'>[];

export const getMyTasks: Tool<GetMyTasksInput, GetMyTasksOutput> = {
  name: 'getMyTasks',
  description: [
    'Use when the current user asks about their own work — "my tasks", "what am I doing today", "what\'s on my plate", "what did I finish yesterday".',
    'Returns a list of tasks assigned to the current user, optionally filtered by status and scheduled-date range. Each task includes id, title, status, column, priority, scheduled date, estimate/actual minutes, and timestamps.',
    "Do not use for questions about other team members' work (prefer getMemberTasks or getTasks) or for non-task data (brands, action items, meetings have their own tools).",
  ].join(' '),
  inputSchema: getMyTasksInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const conditions = [eq(tasks.assigneeId, ctx.userId)];
    if (args.status) conditions.push(eq(tasks.status, args.status));
    if (args.dateFrom) conditions.push(gte(tasks.scheduledDate, args.dateFrom));
    if (args.dateTo) conditions.push(lte(tasks.scheduledDate, args.dateTo));

    const rows = await ctx.db
      .select({
        id: tasks.id,
        creatorId: tasks.creatorId,
        assigneeId: tasks.assigneeId,
        title: tasks.title,
        roleId: tasks.roleId,
        priority: tasks.priority,
        estimateMinutes: tasks.estimateMinutes,
        actualMinutes: tasks.actualMinutes,
        status: tasks.status,
        column: tasks.column,
        scheduledDate: tasks.scheduledDate,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(and(...conditions))
      // scheduledDate asc with nulls last, then priority desc (high first),
      // then createdAt asc — so "what's next" queries naturally sort by
      // the date the user put on it.
      .orderBy(asc(tasks.scheduledDate), desc(tasks.priority), asc(tasks.createdAt))
      .limit(args.limit);

    return rows.map((row) => ({
      id: row.id,
      creatorId: row.creatorId,
      assigneeId: row.assigneeId,
      title: row.title,
      roleId: row.roleId,
      priority: row.priority,
      estimateMinutes: row.estimateMinutes,
      actualMinutes: row.actualMinutes,
      status: row.status,
      column: row.column,
      scheduledDate: row.scheduledDate,
      createdAt: toIso(row.createdAt),
      startedAt: toIsoNullable(row.startedAt),
      completedAt: toIsoNullable(row.completedAt),
    }));
  },
};

function toIso(value: Date): string {
  return value.toISOString();
}

function toIsoNullable(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/* ─────────────── getTasks ─────────────── */

const getTasksInputSchema = z.object({
  assigneeId: z
    .string()
    .uuid()
    .optional()
    .describe('Filter to tasks assigned to a specific team member.'),
  status: z.enum(['todo', 'in_progress', 'done']).optional().describe('Filter by task status.'),
  dateFrom: isoDateSchema
    .optional()
    .describe('ISO date (YYYY-MM-DD). Returns tasks scheduled on or after this date.'),
  dateTo: isoDateSchema
    .optional()
    .describe('ISO date (YYYY-MM-DD). Returns tasks scheduled on or before this date.'),
  brandId: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Filter to tasks linked to any action item on this brand. (Momentum has no direct task↔brand link; this resolves via brand_action_items.linked_task_id.)',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum number of tasks to return. Default 50, max 100.'),
});

export type GetTasksInput = z.infer<typeof getTasksInputSchema>;
export type GetTasksOutput = Omit<Task, 'description'>[];

export const getTasks: Tool<GetTasksInput, GetTasksOutput> = {
  name: 'getTasks',
  description: [
    'Use when the user asks about tasks across the team or about someone specific — "what is Sara working on", "which tasks are blocked", "what did the team ship this week".',
    'Returns tasks matching the filters. Each task includes id, title, status, column, priority, scheduled date, estimate/actual minutes, assignee, creator, and timestamps.',
    "Do not use for the asker's own tasks (prefer getMyTasks — specific tools are cheaper) or for a single task by id (use getTaskById).",
  ].join(' '),
  inputSchema: getTasksInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const conditions = [];
    if (args.assigneeId) conditions.push(eq(tasks.assigneeId, args.assigneeId));
    if (args.status) conditions.push(eq(tasks.status, args.status));
    if (args.dateFrom) conditions.push(gte(tasks.scheduledDate, args.dateFrom));
    if (args.dateTo) conditions.push(lte(tasks.scheduledDate, args.dateTo));

    if (args.brandId) {
      // No direct FK; resolve task ids via brand_action_items.linked_task_id.
      const linked = await ctx.db
        .select({ linkedTaskId: brandActionItems.linkedTaskId })
        .from(brandActionItems)
        .where(eq(brandActionItems.brandId, args.brandId));
      const ids = linked
        .map((r) => r.linkedTaskId)
        .filter((id): id is string => typeof id === 'string');
      if (ids.length === 0) return [];
      conditions.push(inArray(tasks.id, ids));
    }

    const base = ctx.db
      .select({
        id: tasks.id,
        creatorId: tasks.creatorId,
        assigneeId: tasks.assigneeId,
        title: tasks.title,
        roleId: tasks.roleId,
        priority: tasks.priority,
        estimateMinutes: tasks.estimateMinutes,
        actualMinutes: tasks.actualMinutes,
        status: tasks.status,
        column: tasks.column,
        scheduledDate: tasks.scheduledDate,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks);

    const q = conditions.length > 0 ? base.where(and(...conditions)) : base;
    const rows = await q
      .orderBy(asc(tasks.scheduledDate), desc(tasks.priority), asc(tasks.createdAt))
      .limit(args.limit);

    return rows.map((row) => ({
      id: row.id,
      creatorId: row.creatorId,
      assigneeId: row.assigneeId,
      title: row.title,
      roleId: row.roleId,
      priority: row.priority,
      estimateMinutes: row.estimateMinutes,
      actualMinutes: row.actualMinutes,
      status: row.status,
      column: row.column,
      scheduledDate: row.scheduledDate,
      createdAt: toIso(row.createdAt),
      startedAt: toIsoNullable(row.startedAt),
      completedAt: toIsoNullable(row.completedAt),
    }));
  },
};

/* ─────────────── getTaskById ─────────────── */

const getTaskByIdInputSchema = z.object({
  taskId: z.string().uuid(),
});

export type GetTaskByIdInput = z.infer<typeof getTaskByIdInputSchema>;
export type GetTaskByIdOutput = Task | null;

export const getTaskById: Tool<GetTaskByIdInput, GetTaskByIdOutput> = {
  name: 'getTaskById',
  description: [
    'Use when the user asks for the full detail of a specific task — "show me task X", "what\'s the description on the onboarding task".',
    "Returns the complete task record including description (which getMyTasks / getTasks omit for payload-size reasons). Returns null when the id doesn't exist.",
    'Do not use for browsing tasks — use getMyTasks or getTasks.',
  ].join(' '),
  inputSchema: getTaskByIdInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const rows = await ctx.db.select().from(tasks).where(eq(tasks.id, args.taskId)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      creatorId: row.creatorId,
      assigneeId: row.assigneeId,
      title: row.title,
      description: row.description,
      roleId: row.roleId,
      priority: row.priority,
      estimateMinutes: row.estimateMinutes,
      actualMinutes: row.actualMinutes,
      status: row.status,
      column: row.column,
      scheduledDate: row.scheduledDate,
      createdAt: toIso(row.createdAt),
      startedAt: toIsoNullable(row.startedAt),
      completedAt: toIsoNullable(row.completedAt),
    };
  },
};
