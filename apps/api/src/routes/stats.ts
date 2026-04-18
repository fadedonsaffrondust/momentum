import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, gte, isNull, inArray, sql } from 'drizzle-orm';
import {
  weeklyStatsSchema,
  teamWeeklyStatsSchema,
  teamTodayStatsSchema,
  toLocalIsoDate,
} from '@momentum/shared';
import { tasks, dailyLogs, users } from '@momentum/db';
import { db } from '../db.ts';
import { mapUserSummary } from '../mappers.ts';

interface WeeklyLogRow {
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  completionRate: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
}

interface RoleCountRow {
  roleId: string | null;
  cnt: number;
}

function buildSevenDayTimeline(
  sevenDaysAgo: Date,
  logs: readonly WeeklyLogRow[],
): Array<{
  date: string;
  tasksCompleted: number;
  tasksPlanned: number;
  completionRate: number;
}> {
  const logByDate = new Map(logs.map((l) => [l.date, l]));
  return Array.from({ length: 7 }, (_, i) => {
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
}

function computeWeeklyStats(
  logs: readonly WeeklyLogRow[],
  roleCounts: readonly RoleCountRow[],
  sevenDaysAgo: Date,
): {
  days: ReturnType<typeof buildSevenDayTimeline>;
  averageCompletionRate: number;
  mostActiveRoleId: string | null;
  estimationAccuracy: number | null;
  streak: number;
} {
  const days = buildSevenDayTimeline(sevenDaysAgo, logs);

  const daysWithWork = days.filter((d) => d.tasksPlanned > 0);
  const averageCompletionRate =
    daysWithWork.length > 0
      ? daysWithWork.reduce((a, d) => a + d.completionRate, 0) / daysWithWork.length
      : 0;

  let mostActiveRoleId: string | null = null;
  let topCount = 0;
  for (const r of roleCounts) {
    if (r.roleId && r.cnt > topCount) {
      mostActiveRoleId = r.roleId;
      topCount = r.cnt;
    }
  }

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

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    if (d.tasksPlanned > 0 && d.completionRate >= 0.8) streak += 1;
    else break;
  }

  return { days, averageCompletionRate, mostActiveRoleId, estimationAccuracy, streak };
}

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

      const logs = (await db
        .select()
        .from(dailyLogs)
        .where(
          and(eq(dailyLogs.userId, req.userId), gte(dailyLogs.date, sevenDaysAgoIso)),
        )) as WeeklyLogRow[];

      const roleCounts = (await db
        .select({
          roleId: tasks.roleId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.assigneeId, req.userId),
            eq(tasks.status, 'done'),
            gte(tasks.scheduledDate, sevenDaysAgoIso),
          ),
        )
        .groupBy(tasks.roleId)) as RoleCountRow[];

      const stats = computeWeeklyStats(logs, roleCounts, sevenDaysAgo);
      return stats;
    },
  );

  /**
   * Per-user team-weekly summary. One row per active user. Deactivated
   * users are excluded — their stats aren't useful in "team" context.
   */
  app.get(
    '/stats/team-weekly',
    { schema: { response: { 200: teamWeeklyStatsSchema } } },
    async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDaysAgoIso = toLocalIsoDate(sevenDaysAgo);

      const activeUsers = await db
        .select()
        .from(users)
        .where(isNull(users.deactivatedAt));

      if (activeUsers.length === 0) return { users: [] };

      const userIds = activeUsers.map((u) => u.id);

      // Load all logs + role counts in two batch queries, group in memory.
      const allLogs = (await db
        .select()
        .from(dailyLogs)
        .where(
          and(inArray(dailyLogs.userId, userIds), gte(dailyLogs.date, sevenDaysAgoIso)),
        )) as Array<WeeklyLogRow & { userId: string }>;

      const allRoleCounts = (await db
        .select({
          assigneeId: tasks.assigneeId,
          roleId: tasks.roleId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(
          and(
            inArray(tasks.assigneeId, userIds),
            eq(tasks.status, 'done'),
            gte(tasks.scheduledDate, sevenDaysAgoIso),
          ),
        )
        .groupBy(tasks.assigneeId, tasks.roleId)) as Array<{
        assigneeId: string;
        roleId: string | null;
        cnt: number;
      }>;

      const logsByUser = new Map<string, WeeklyLogRow[]>();
      for (const l of allLogs) {
        const list = logsByUser.get(l.userId) ?? [];
        list.push({
          date: l.date,
          tasksPlanned: l.tasksPlanned,
          tasksCompleted: l.tasksCompleted,
          completionRate: l.completionRate,
          totalEstimatedMinutes: l.totalEstimatedMinutes,
          totalActualMinutes: l.totalActualMinutes,
        });
        logsByUser.set(l.userId, list);
      }

      const roleCountsByUser = new Map<string, RoleCountRow[]>();
      for (const r of allRoleCounts) {
        const list = roleCountsByUser.get(r.assigneeId) ?? [];
        list.push({ roleId: r.roleId, cnt: r.cnt });
        roleCountsByUser.set(r.assigneeId, list);
      }

      const usersStats = activeUsers.map((u) => {
        const stats = computeWeeklyStats(
          logsByUser.get(u.id) ?? [],
          roleCountsByUser.get(u.id) ?? [],
          sevenDaysAgo,
        );
        return {
          user: mapUserSummary(u),
          completionRate: stats.averageCompletionRate,
          estimationAccuracy: stats.estimationAccuracy,
          streak: stats.streak,
          mostActiveRoleId: stats.mostActiveRoleId,
        };
      });

      return { users: usersStats };
    },
  );

  /**
   * Cheap team-today summary for the EOD pulse strip.
   * - teamCompletionRate = done-today / all-today across every active-user task.
   * - usersWithInProgressCount = active users with ≥1 task currently in_progress
   *   (not date-scoped — an in-progress task that spans days still counts).
   */
  app.get(
    '/stats/team-today',
    { schema: { response: { 200: teamTodayStatsSchema } } },
    async () => {
      const todayIso = toLocalIsoDate(new Date());

      const activeUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(isNull(users.deactivatedAt));

      if (activeUsers.length === 0) {
        return { teamCompletionRate: 0, usersWithInProgressCount: 0 };
      }

      const userIds = activeUsers.map((u) => u.id);

      // Today's tasks across the team.
      const todayTasks = await db
        .select({ status: tasks.status })
        .from(tasks)
        .where(
          and(
            inArray(tasks.assigneeId, userIds),
            eq(tasks.scheduledDate, todayIso),
          ),
        );

      const total = todayTasks.length;
      const done = todayTasks.filter((t) => t.status === 'done').length;
      const teamCompletionRate = total > 0 ? done / total : 0;

      // Distinct active-user assignees with any in_progress task. Kept as
      // a regular select + in-memory dedup (instead of selectDistinct) so
      // the mock-db pattern used in tests doesn't need a new method.
      const inProgressRows = await db
        .select({ assigneeId: tasks.assigneeId })
        .from(tasks)
        .where(
          and(
            inArray(tasks.assigneeId, userIds),
            eq(tasks.status, 'in_progress'),
          ),
        );
      const usersWithInProgressCount = new Set(
        inProgressRows.map((r) => r.assigneeId),
      ).size;

      return { teamCompletionRate, usersWithInProgressCount };
    },
  );
};
