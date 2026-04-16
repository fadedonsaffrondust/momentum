import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, gte, sql } from 'drizzle-orm';
import { weeklyStatsSchema, toLocalIsoDate } from '@momentum/shared';
import { tasks, dailyLogs } from '@momentum/db';
import { db } from '../db.ts';

export const statsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/stats/weekly',
    { schema: { response: { 200: weeklyStatsSchema } } },
    async (req) => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDaysAgoIso = toLocalIsoDate(sevenDaysAgo);

      // Pull logs for last 7 days.
      const logs = await db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.userId, req.userId), gte(dailyLogs.date, sevenDaysAgoIso)));

      const logByDate = new Map(logs.map((l) => [l.date, l]));

      // Build 7-day timeline.
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const iso = toLocalIsoDate(d);
        const log = logByDate.get(iso);
        return {
          date: iso,
          tasksCompleted: log?.tasksCompleted ?? 0,
          tasksPlanned: log?.tasksPlanned ?? 0,
          completionRate: log?.completionRate ?? 0,
        };
      });

      const completedDays = days.filter((d) => d.tasksPlanned > 0);
      const averageCompletionRate =
        completedDays.length > 0
          ? completedDays.reduce((a, d) => a + d.completionRate, 0) / completedDays.length
          : 0;

      // Most active role in last 7 days.
      const roleCounts = await db
        .select({
          roleId: tasks.roleId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, req.userId),
            eq(tasks.status, 'done'),
            gte(tasks.scheduledDate, sevenDaysAgoIso),
          ),
        )
        .groupBy(tasks.roleId);

      let mostActiveRoleId: string | null = null;
      let topCount = 0;
      for (const r of roleCounts) {
        if (r.roleId && r.cnt > topCount) {
          mostActiveRoleId = r.roleId;
          topCount = r.cnt;
        }
      }

      // Estimation accuracy: avg(estimate / actual) across done tasks, clamped to [0, 2].
      const estAccuracy = logs.reduce(
        (acc, l) => {
          if (l.totalActualMinutes > 0) {
            acc.sum += l.totalEstimatedMinutes / l.totalActualMinutes;
            acc.n += 1;
          }
          return acc;
        },
        { sum: 0, n: 0 },
      );
      const estimationAccuracy = estAccuracy.n > 0 ? estAccuracy.sum / estAccuracy.n : null;

      // Streak: consecutive days from today backwards with >=0.8 completion rate.
      let streak = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        const d = days[i]!;
        if (d.tasksPlanned > 0 && d.completionRate >= 0.8) streak += 1;
        else break;
      }

      return {
        days,
        averageCompletionRate,
        mostActiveRoleId,
        estimationAccuracy,
        streak,
      };
    },
  );
};
