import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { dailyLogSchema, upsertDailyLogInputSchema, isoDateSchema } from '@momentum/shared';
import { dailyLogs, tasks } from '@momentum/db';
import { db } from '../db.ts';
import { mapDailyLog } from '../mappers.ts';
import { notFound } from '../errors.ts';

export const dailyLogsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/daily-logs',
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().positive().max(365).default(30) }),
        response: { 200: z.array(dailyLogSchema) },
      },
    },
    async (req) => {
      const rows = await db
        .select()
        .from(dailyLogs)
        .where(eq(dailyLogs.userId, req.userId))
        .orderBy(desc(dailyLogs.date))
        .limit(req.query.limit);
      return rows.map(mapDailyLog);
    },
  );

  app.post(
    '/daily-logs',
    {
      schema: {
        body: upsertDailyLogInputSchema,
        response: { 200: dailyLogSchema },
      },
    },
    async (req) => {
      const { date, journalEntry } = req.body;

      // Compute stats from tasks on that date, scoped to this user as
      // assignee — daily_logs are personal, not team-wide.
      const dayTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.assigneeId, req.userId), eq(tasks.scheduledDate, date)));

      const tasksPlanned = dayTasks.length;
      const done = dayTasks.filter((t) => t.status === 'done');
      const tasksCompleted = done.length;
      const totalEstimatedMinutes = dayTasks.reduce((a, t) => a + (t.estimateMinutes ?? 0), 0);
      const totalActualMinutes = done.reduce((a, t) => a + (t.actualMinutes ?? 0), 0);
      const completionRate = tasksPlanned > 0 ? tasksCompleted / tasksPlanned : 0;

      const [row] = await db
        .insert(dailyLogs)
        .values({
          userId: req.userId,
          date,
          tasksPlanned,
          tasksCompleted,
          totalEstimatedMinutes,
          totalActualMinutes,
          journalEntry: journalEntry ?? null,
          completionRate,
        })
        .onConflictDoUpdate({
          target: [dailyLogs.userId, dailyLogs.date],
          set: {
            tasksPlanned,
            tasksCompleted,
            totalEstimatedMinutes,
            totalActualMinutes,
            journalEntry: sql`COALESCE(EXCLUDED.journal_entry, ${dailyLogs.journalEntry})`,
            completionRate,
          },
        })
        .returning();

      if (!row) throw notFound('Daily log not found');
      return mapDailyLog(row);
    },
  );

  app.get(
    '/daily-logs/:date',
    {
      schema: {
        params: z.object({ date: isoDateSchema }),
        response: { 200: dailyLogSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.userId, req.userId), eq(dailyLogs.date, req.params.date)))
        .limit(1);
      if (!row) throw notFound('Daily log not found');
      return mapDailyLog(row);
    },
  );
};
