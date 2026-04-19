import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, count, desc, asc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  taskSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  isoDateSchema,
  teamTaskListSchema,
  toLocalIsoDate,
  type UserSummary,
  type Task,
} from '@momentum/shared';
import { tasks, brandActionItems, users } from '@momentum/db';
import { db } from '../db.ts';
import { mapTask, mapUserSummary } from '../mappers.ts';
import { badRequest, notFound } from '../errors.ts';
import { recordInboxEvent } from '../services/events.ts';

const MAX_IN_PROGRESS = 2;

/**
 * Fields whose change in a PATCH /tasks/:id counts as a "meaningful" edit
 * for inbox purposes. Status/column transitions use dedicated endpoints
 * and don't go through this notification path per spec §7.1.
 */
const EDIT_NOTIFY_FIELDS = [
  'title',
  'description',
  'priority',
  'estimateMinutes',
  'roleId',
  'scheduledDate',
] as const;

export const tasksRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/tasks',
    {
      schema: {
        querystring: z.object({
          date: isoDateSchema.optional(),
          roleId: z.string().uuid().optional(),
          status: z.enum(['todo', 'in_progress', 'done']).optional(),
          // 'ALL' returns team-wide; any uuid scopes to that assignee; default
          // is the current user (backward-compat).
          assigneeId: z.union([z.string().uuid(), z.literal('ALL')]).optional(),
          creatorId: z.string().uuid().optional(),
        }),
        response: { 200: z.array(taskSchema) },
      },
    },
    async (req) => {
      const conds = [];
      const assigneeFilter = req.query.assigneeId ?? req.userId;
      if (assigneeFilter !== 'ALL') conds.push(eq(tasks.assigneeId, assigneeFilter));
      if (req.query.creatorId) conds.push(eq(tasks.creatorId, req.query.creatorId));
      if (req.query.date) conds.push(eq(tasks.scheduledDate, req.query.date));
      if (req.query.roleId) conds.push(eq(tasks.roleId, req.query.roleId));
      if (req.query.status) conds.push(eq(tasks.status, req.query.status));

      const base = db.select().from(tasks);
      const q = conds.length > 0 ? base.where(and(...conds)) : base;
      const rows = await q.orderBy(desc(tasks.createdAt));
      return rows.map(mapTask);
    },
  );

  /**
   * Team Task View endpoint. Returns all team tasks grouped by assignee.
   * Current user's section is first; remaining users alpha-sorted by
   * displayName. Deactivated users are excluded (they can't log in and
   * can't be assignees going forward).
   */
  app.get(
    '/tasks/team',
    {
      schema: {
        querystring: z.object({
          date: isoDateSchema.optional(),
          status: z.enum(['todo', 'in_progress', 'done']).optional(),
        }),
        response: { 200: teamTaskListSchema },
      },
    },
    async (req) => {
      const activeUsers = await db
        .select()
        .from(users)
        .where(isNull(users.deactivatedAt))
        .orderBy(asc(users.displayName), asc(users.email));

      const dateFilter = req.query.date ?? toLocalIsoDate(new Date());
      const taskConds = [eq(tasks.scheduledDate, dateFilter)];
      if (req.query.status) taskConds.push(eq(tasks.status, req.query.status));

      const allTasks = await db
        .select()
        .from(tasks)
        .where(and(...taskConds))
        .orderBy(desc(tasks.createdAt));

      const byAssignee = new Map<string, typeof allTasks>();
      for (const t of allTasks) {
        const list = byAssignee.get(t.assigneeId) ?? [];
        list.push(t);
        byAssignee.set(t.assigneeId, list);
      }

      const sections: Array<{ user: UserSummary; tasks: Task[] }> = [];
      const currentFirst = activeUsers.find((u) => u.id === req.userId);
      if (currentFirst) {
        sections.push({
          user: mapUserSummary(currentFirst),
          tasks: (byAssignee.get(req.userId) ?? []).map(mapTask),
        });
      }
      for (const u of activeUsers) {
        if (u.id === req.userId) continue;
        sections.push({
          user: mapUserSummary(u),
          tasks: (byAssignee.get(u.id) ?? []).map(mapTask),
        });
      }

      return { sections };
    },
  );

  app.post(
    '/tasks',
    {
      schema: {
        body: createTaskInputSchema,
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const body = req.body;
      const assigneeId = body.assigneeId ?? req.userId;

      const [row] = await db
        .insert(tasks)
        .values({
          creatorId: req.userId,
          assigneeId,
          title: body.title,
          description: body.description ?? null,
          roleId: body.roleId ?? null,
          priority: body.priority ?? 'medium',
          estimateMinutes: body.estimateMinutes ?? null,
          scheduledDate: body.scheduledDate ?? toLocalIsoDate(new Date()),
        })
        .returning();
      if (!row) throw new Error('Failed to create task');

      if (assigneeId !== req.userId) {
        await recordInboxEvent({
          userId: assigneeId,
          actorId: req.userId,
          eventType: 'task_assigned',
          entityType: 'task',
          entityId: row.id,
          payload: { title: row.title },
        });
      }

      return mapTask(row);
    },
  );

  app.patch(
    '/tasks/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateTaskInputSchema,
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const [existing] = await db.select().from(tasks).where(eq(tasks.id, req.params.id)).limit(1);
      if (!existing) throw notFound('Task not found');

      const { assigneeId: newAssigneeId, ...rest } = req.body;
      const isReassignment = newAssigneeId !== undefined && newAssigneeId !== existing.assigneeId;

      const updateSet: Record<string, unknown> = { ...rest };
      if (newAssigneeId !== undefined) updateSet.assigneeId = newAssigneeId;

      // Reassignment-over-capacity rule (spec §16.1): if the task is in
      // progress and the new assignee is already at MAX_IN_PROGRESS,
      // silently reset the task to todo/up_next. No error, no inbox event
      // beyond the standard task_assigned — the assignee sees the reassigned
      // task on their Up Next column and can start it when ready.
      if (isReassignment && existing.status === 'in_progress') {
        const [countRow] = (await db
          .select({ inProgressCount: count() })
          .from(tasks)
          .where(and(eq(tasks.assigneeId, newAssigneeId!), eq(tasks.status, 'in_progress')))) as [
          { inProgressCount: number },
        ];
        if ((countRow?.inProgressCount ?? 0) >= MAX_IN_PROGRESS) {
          updateSet.status = 'todo';
          updateSet.column = 'up_next';
        }
      }

      const [row] = await db
        .update(tasks)
        .set(updateSet)
        .where(eq(tasks.id, req.params.id))
        .returning();
      if (!row) throw notFound('Task not found');

      if (isReassignment) {
        await recordInboxEvent({
          userId: row.assigneeId,
          actorId: req.userId,
          eventType: 'task_assigned',
          entityType: 'task',
          entityId: row.id,
          payload: { previousAssigneeId: existing.assigneeId, title: row.title },
        });
      }

      // Edit notification (spec §7.1): fires when a non-assignee edits a
      // meaningful field AND the assignee didn't create the task themselves.
      // The self-create case is skipped because those edits are the owner's
      // own business and shouldn't clutter their inbox.
      const changedNotifyFields = EDIT_NOTIFY_FIELDS.filter((f) => f in rest);
      if (
        changedNotifyFields.length > 0 &&
        req.userId !== row.assigneeId &&
        row.assigneeId !== row.creatorId
      ) {
        await recordInboxEvent({
          userId: row.assigneeId,
          actorId: req.userId,
          eventType: 'task_edited',
          entityType: 'task',
          entityId: row.id,
          payload: {
            changedFields: changedNotifyFields,
            title: row.title,
          },
        });
      }

      return mapTask(row);
    },
  );

  app.delete(
    '/tasks/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [row] = await db
        .delete(tasks)
        .where(eq(tasks.id, req.params.id))
        .returning({ id: tasks.id });
      if (!row) throw notFound('Task not found');
      return { ok: true as const };
    },
  );

  /**
   * Time-tracking model:
   *   - `startedAt` is the start of the CURRENT work session (null when not
   *     actively in progress).
   *   - `actualMinutes` is the accumulated total across all sessions.
   *   - On /start: set startedAt = NOW() (a fresh session begins; prior
   *     startedAt, if any, should already be null because /pause, /complete,
   *     and /reopen all clear it).
   *   - On /pause and /complete: roll the current session's elapsed minutes
   *     into actualMinutes, then clear startedAt.
   *   - On /reopen: clear startedAt AND completedAt; preserve actualMinutes
   *     as a historical record of prior work.
   * This keeps time accurate across multiple pause/resume and reopen cycles.
   */
  app.post(
    '/tasks/:id/start',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const [countRow] = (await db
        .select({ inProgressCount: count() })
        .from(tasks)
        .where(and(eq(tasks.assigneeId, req.userId), eq(tasks.status, 'in_progress')))) as [
        { inProgressCount: number },
      ];

      if ((countRow?.inProgressCount ?? 0) >= MAX_IN_PROGRESS) {
        throw badRequest(
          `Max ${MAX_IN_PROGRESS} tasks in progress. Pause one before starting another.`,
        );
      }

      const [row] = await db
        .update(tasks)
        .set({
          status: 'in_progress',
          column: 'in_progress',
          startedAt: new Date(),
        })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.assigneeId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');
      return mapTask(row);
    },
  );

  app.post(
    '/tasks/:id/pause',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, req.params.id), eq(tasks.assigneeId, req.userId)))
        .limit(1);
      if (!existing) throw notFound('Task not found');

      let actualMinutes: number | null = existing.actualMinutes;
      if (existing.startedAt) {
        const elapsed = Math.max(
          0,
          Math.round((Date.now() - existing.startedAt.getTime()) / 60000),
        );
        actualMinutes = (actualMinutes ?? 0) + elapsed;
      }

      const [row] = await db
        .update(tasks)
        .set({
          status: 'todo',
          column: 'up_next',
          startedAt: null,
          actualMinutes,
        })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.assigneeId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');
      return mapTask(row);
    },
  );

  app.post(
    '/tasks/:id/complete',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, req.params.id), eq(tasks.assigneeId, req.userId)))
        .limit(1);
      if (!existing) throw notFound('Task not found');

      let actualMinutes: number | null = existing.actualMinutes;
      if (existing.startedAt) {
        const elapsed = Math.max(
          0,
          Math.round((Date.now() - existing.startedAt.getTime()) / 60000),
        );
        actualMinutes = (actualMinutes ?? 0) + elapsed;
      }

      const [row] = await db
        .update(tasks)
        .set({
          status: 'done',
          column: 'done',
          completedAt: new Date(),
          startedAt: null,
          actualMinutes,
        })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.assigneeId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');

      // Bidirectional sync: team-shared action items no longer have user_id.
      // Marking the linked action item done when the task completes.
      await db
        .update(brandActionItems)
        .set({ status: 'done', completedAt: new Date() })
        .where(and(eq(brandActionItems.linkedTaskId, row.id), eq(brandActionItems.status, 'open')));

      return mapTask(row);
    },
  );

  /**
   * Reopen a completed task (undo a /complete, typically after an accidental
   * drop on the Done column or Space press). Resets status/column to
   * todo/up_next, clears completedAt + startedAt so a subsequent /start
   * begins a fresh timer. Preserves actualMinutes as a historical record of
   * prior work on the task.
   */
  app.post(
    '/tasks/:id/reopen',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .update(tasks)
        .set({
          status: 'todo',
          column: 'up_next',
          completedAt: null,
          startedAt: null,
        })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.assigneeId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');

      // Mirror /complete's action-item propagation: if the task was linked
      // to a brand action item and marked done alongside, reopen it too.
      await db
        .update(brandActionItems)
        .set({ status: 'open', completedAt: null })
        .where(and(eq(brandActionItems.linkedTaskId, row.id), eq(brandActionItems.status, 'done')));

      return mapTask(row);
    },
  );

  app.post(
    '/tasks/:id/defer',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ scheduledDate: isoDateSchema }).optional(),
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const target =
        req.body?.scheduledDate ?? toLocalIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

      const [row] = await db
        .update(tasks)
        .set({ scheduledDate: target, status: 'todo', column: 'up_next' })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.assigneeId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');
      return mapTask(row);
    },
  );
};
