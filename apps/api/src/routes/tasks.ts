import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, sql, count, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  taskSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  isoDateSchema,
  toLocalIsoDate,
} from '@momentum/shared';
import { tasks, brandActionItems } from '@momentum/db';
import { db } from '../db.ts';
import { mapTask } from '../mappers.ts';
import { badRequest, notFound } from '../errors.ts';

const MAX_IN_PROGRESS = 2;

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
        }),
        response: { 200: z.array(taskSchema) },
      },
    },
    async (req) => {
      const conds = [eq(tasks.userId, req.userId)];
      if (req.query.date) conds.push(eq(tasks.scheduledDate, req.query.date));
      if (req.query.roleId) conds.push(eq(tasks.roleId, req.query.roleId));
      if (req.query.status) conds.push(eq(tasks.status, req.query.status));

      const rows = await db
        .select()
        .from(tasks)
        .where(and(...conds))
        .orderBy(desc(tasks.createdAt));
      return rows.map(mapTask);
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
      const [row] = await db
        .insert(tasks)
        .values({
          userId: req.userId,
          title: body.title,
          roleId: body.roleId ?? null,
          priority: body.priority ?? 'medium',
          estimateMinutes: body.estimateMinutes ?? null,
          scheduledDate: body.scheduledDate ?? toLocalIsoDate(new Date()),
        })
        .returning();
      if (!row) throw new Error('Failed to create task');
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
      const [row] = await db
        .update(tasks)
        .set(req.body)
        .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');
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
        .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId)))
        .returning({ id: tasks.id });
      if (!row) throw notFound('Task not found');
      return { ok: true as const };
    },
  );

  app.post(
    '/tasks/:id/start',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: taskSchema },
      },
    },
    async (req) => {
      const [{ inProgressCount }] = (await db
        .select({ inProgressCount: count() })
        .from(tasks)
        .where(
          and(eq(tasks.userId, req.userId), eq(tasks.status, 'in_progress')),
        )) as [{ inProgressCount: number }];

      if (inProgressCount >= MAX_IN_PROGRESS) {
        throw badRequest(
          `Max ${MAX_IN_PROGRESS} tasks in progress. Pause one before starting another.`,
        );
      }

      const [row] = await db
        .update(tasks)
        .set({
          status: 'in_progress',
          column: 'in_progress',
          startedAt: sql`COALESCE(${tasks.startedAt}, NOW())`,
        })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId)))
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
      const [row] = await db
        .update(tasks)
        .set({ status: 'todo', column: 'up_next' })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId)))
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
        .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId)))
        .limit(1);
      if (!existing) throw notFound('Task not found');

      let actualMinutes: number | null = existing.actualMinutes;
      if (existing.startedAt) {
        actualMinutes = Math.max(
          1,
          Math.round((Date.now() - existing.startedAt.getTime()) / 60000),
        );
      }

      const [row] = await db
        .update(tasks)
        .set({
          status: 'done',
          column: 'done',
          completedAt: new Date(),
          actualMinutes,
        })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');

      // Bidirectional sync: mark any linked brand action item as done.
      await db
        .update(brandActionItems)
        .set({ status: 'done', completedAt: new Date() })
        .where(
          and(
            eq(brandActionItems.linkedTaskId, row.id),
            eq(brandActionItems.userId, req.userId),
            eq(brandActionItems.status, 'open'),
          ),
        );

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
        req.body?.scheduledDate ??
        toLocalIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

      const [row] = await db
        .update(tasks)
        .set({ scheduledDate: target, status: 'todo', column: 'up_next' })
        .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId)))
        .returning();
      if (!row) throw notFound('Task not found');
      return mapTask(row);
    },
  );
};
