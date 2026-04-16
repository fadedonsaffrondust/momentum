import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { exportFileSchema, importRequestSchema } from '@momentum/shared';
import { users, userSettings, roles, tasks, dailyLogs, parkings } from '@momentum/db';
import { db } from '../db.ts';
import { mapTask, mapRole, mapSettings, mapDailyLog, mapParking } from '../mappers.ts';
import { notFound } from '../errors.ts';

export const dataRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/export',
    { schema: { response: { 200: exportFileSchema } } },
    async (req) => {
      const [settingsRow] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, req.userId))
        .limit(1);
      if (!settingsRow) throw notFound('Settings not found');

      const roleRows = await db.select().from(roles).where(eq(roles.userId, req.userId));
      const taskRows = await db.select().from(tasks).where(eq(tasks.userId, req.userId));
      const logRows = await db
        .select()
        .from(dailyLogs)
        .where(eq(dailyLogs.userId, req.userId));
      const parkingRows = await db
        .select()
        .from(parkings)
        .where(eq(parkings.userId, req.userId));

      const { userId: _ignoredUserId, ...settingsNoUser } = mapSettings(settingsRow);

      // Mark last export date.
      await db
        .update(userSettings)
        .set({ lastExportDate: new Date() })
        .where(eq(userSettings.userId, req.userId));

      return {
        version: '1.1' as const,
        exportedAt: new Date().toISOString(),
        settings: settingsNoUser,
        roles: roleRows.map(mapRole),
        tasks: taskRows.map((t) => {
          const { userId: _u, ...rest } = mapTask(t);
          return rest;
        }),
        dailyLogs: logRows.map((l) => {
          const { userId: _u, ...rest } = mapDailyLog(l);
          return rest;
        }),
        parkings: parkingRows.map((p) => {
          const { userId: _u, ...rest } = mapParking(p);
          return rest;
        }),
      };
    },
  );

  app.post(
    '/import',
    {
      schema: {
        body: importRequestSchema,
        response: {
          200: z.object({
            ok: z.literal(true),
            imported: z.object({
              tasks: z.number(),
              roles: z.number(),
              dailyLogs: z.number(),
              parkings: z.number(),
            }),
          }),
        },
      },
    },
    async (req) => {
      const { mode, file } = req.body;

      if (mode === 'replace') {
        await db.delete(parkings).where(eq(parkings.userId, req.userId));
        await db.delete(tasks).where(eq(tasks.userId, req.userId));
        await db.delete(dailyLogs).where(eq(dailyLogs.userId, req.userId));
        await db.delete(roles).where(eq(roles.userId, req.userId));
      }

      // Apply settings (always merge).
      await db
        .update(userSettings)
        .set({
          dailyCapacityMinutes: file.settings.dailyCapacityMinutes,
          theme: file.settings.theme,
          userName: file.settings.userName,
          onboarded: file.settings.onboarded,
        })
        .where(eq(userSettings.userId, req.userId));

      // Re-map role IDs: if imported id matches an existing row (merge mode), skip.
      // For simplicity: always insert with fresh IDs and remap task.roleId accordingly.
      const roleIdMap = new Map<string, string>();
      let importedRoles = 0;
      for (const r of file.roles) {
        const [inserted] = await db
          .insert(roles)
          .values({
            userId: req.userId,
            name: r.name,
            color: r.color,
            position: r.position,
          })
          .returning({ id: roles.id });
        if (inserted) {
          roleIdMap.set(r.id, inserted.id);
          importedRoles++;
        }
      }

      let importedTasks = 0;
      for (const t of file.tasks) {
        await db.insert(tasks).values({
          userId: req.userId,
          title: t.title,
          roleId: t.roleId ? (roleIdMap.get(t.roleId) ?? null) : null,
          priority: t.priority,
          estimateMinutes: t.estimateMinutes,
          actualMinutes: t.actualMinutes,
          status: t.status,
          column: t.column,
          scheduledDate: t.scheduledDate,
          startedAt: t.startedAt ? new Date(t.startedAt) : null,
          completedAt: t.completedAt ? new Date(t.completedAt) : null,
        });
        importedTasks++;
      }

      let importedLogs = 0;
      for (const l of file.dailyLogs) {
        await db
          .insert(dailyLogs)
          .values({
            userId: req.userId,
            date: l.date,
            tasksPlanned: l.tasksPlanned,
            tasksCompleted: l.tasksCompleted,
            totalEstimatedMinutes: l.totalEstimatedMinutes,
            totalActualMinutes: l.totalActualMinutes,
            journalEntry: l.journalEntry,
            completionRate: l.completionRate,
          })
          .onConflictDoNothing();
        importedLogs++;
      }

      // Parkings (added in export v1.1; older files have no parkings array).
      let importedParkings = 0;
      for (const p of file.parkings ?? []) {
        await db.insert(parkings).values({
          userId: req.userId,
          title: p.title,
          notes: p.notes,
          outcome: p.outcome,
          targetDate: p.targetDate,
          roleId: p.roleId ? (roleIdMap.get(p.roleId) ?? null) : null,
          priority: p.priority,
          status: p.status,
          discussedAt: p.discussedAt ? new Date(p.discussedAt) : null,
        });
        importedParkings++;
      }

      return {
        ok: true as const,
        imported: {
          tasks: importedTasks,
          roles: importedRoles,
          dailyLogs: importedLogs,
          parkings: importedParkings,
        },
      };
    },
  );
};
