import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { exportFileSchema, importRequestSchema } from '@momentum/shared';
import {
  users,
  userSettings,
  roles,
  tasks,
  dailyLogs,
  parkings,
  brands,
  brandStakeholders,
  brandMeetings,
  brandActionItems,
  brandFeatureRequests,
} from '@momentum/db';
import { db } from '../db.ts';
import {
  mapTask,
  mapRole,
  mapSettings,
  mapDailyLog,
  mapParking,
  mapBrand,
  mapBrandStakeholder,
  mapBrandMeeting,
  mapBrandActionItem,
  mapBrandFeatureRequest,
} from '../mappers.ts';
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
      const brandRows = await db.select().from(brands).where(eq(brands.userId, req.userId));
      const stakeholderRows = await db
        .select()
        .from(brandStakeholders)
        .where(eq(brandStakeholders.userId, req.userId));
      const meetingRows = await db
        .select()
        .from(brandMeetings)
        .where(eq(brandMeetings.userId, req.userId));
      const actionItemRows = await db
        .select()
        .from(brandActionItems)
        .where(eq(brandActionItems.userId, req.userId));
      const featureRequestRows = await db
        .select()
        .from(brandFeatureRequests)
        .where(eq(brandFeatureRequests.userId, req.userId));

      const { userId: _ignoredUserId, ...settingsNoUser } = mapSettings(settingsRow);

      // Mark last export date.
      await db
        .update(userSettings)
        .set({ lastExportDate: new Date() })
        .where(eq(userSettings.userId, req.userId));

      return {
        version: '1.3' as const,
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
        brands: brandRows.map((b) => {
          const { userId: _u, ...rest } = mapBrand(b);
          return rest;
        }),
        brandStakeholders: stakeholderRows.map((s) => {
          const { userId: _u, ...rest } = mapBrandStakeholder(s);
          return rest;
        }),
        brandMeetings: meetingRows.map((m) => {
          const { userId: _u, ...rest } = mapBrandMeeting(m);
          return rest;
        }),
        brandActionItems: actionItemRows.map((a) => {
          const { userId: _u, ...rest } = mapBrandActionItem(a);
          return rest;
        }),
        brandFeatureRequests: featureRequestRows.map((fr) => {
          const { userId: _u, ...rest } = mapBrandFeatureRequest(fr);
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
              brands: z.number(),
              brandStakeholders: z.number(),
              brandMeetings: z.number(),
              brandActionItems: z.number(),
              brandFeatureRequests: z.number(),
            }),
          }),
        },
      },
    },
    async (req) => {
      const { mode, file } = req.body;

      if (mode === 'replace') {
        await db.delete(brandFeatureRequests).where(eq(brandFeatureRequests.userId, req.userId));
        await db.delete(brandActionItems).where(eq(brandActionItems.userId, req.userId));
        await db.delete(brandMeetings).where(eq(brandMeetings.userId, req.userId));
        await db.delete(brandStakeholders).where(eq(brandStakeholders.userId, req.userId));
        await db.delete(brands).where(eq(brands.userId, req.userId));
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

      // Brands (added in v1.2).
      const brandIdMap = new Map<string, string>();
      let importedBrands = 0;
      for (const b of file.brands ?? []) {
        const [inserted] = await db
          .insert(brands)
          .values({
            userId: req.userId,
            name: b.name,
            goals: b.goals,
            successDefinition: b.successDefinition,
            customFields: b.customFields ?? {},
            status: b.status === 'importing' ? 'active' : b.status,
            importedFrom: b.importedFrom,
            rawImportContent: b.rawImportContent,
          })
          .returning({ id: brands.id });
        if (inserted) {
          brandIdMap.set(b.id, inserted.id);
          importedBrands++;
        }
      }

      let importedStakeholders = 0;
      for (const s of file.brandStakeholders ?? []) {
        const resolvedBrandId = brandIdMap.get(s.brandId);
        if (!resolvedBrandId) continue;
        await db.insert(brandStakeholders).values({
          brandId: resolvedBrandId,
          userId: req.userId,
          name: s.name,
          role: s.role,
          notes: s.notes,
        });
        importedStakeholders++;
      }

      const meetingIdMap = new Map<string, string>();
      let importedMeetings = 0;
      for (const m of file.brandMeetings ?? []) {
        const resolvedBrandId = brandIdMap.get(m.brandId);
        if (!resolvedBrandId) continue;
        const [inserted] = await db
          .insert(brandMeetings)
          .values({
            brandId: resolvedBrandId,
            userId: req.userId,
            date: m.date,
            title: m.title,
            attendees: m.attendees,
            summary: m.summary,
            rawNotes: m.rawNotes,
            decisions: m.decisions,
          })
          .returning({ id: brandMeetings.id });
        if (inserted) {
          meetingIdMap.set(m.id, inserted.id);
          importedMeetings++;
        }
      }

      let importedActionItems = 0;
      for (const a of file.brandActionItems ?? []) {
        const resolvedBrandId = brandIdMap.get(a.brandId);
        if (!resolvedBrandId) continue;
        await db.insert(brandActionItems).values({
          brandId: resolvedBrandId,
          userId: req.userId,
          meetingId: a.meetingId ? (meetingIdMap.get(a.meetingId) ?? null) : null,
          text: a.text,
          status: a.status,
          owner: a.owner,
          dueDate: a.dueDate,
          completedAt: a.completedAt ? new Date(a.completedAt) : null,
        });
        importedActionItems++;
      }

      let importedFeatureRequests = 0;
      for (const fr of file.brandFeatureRequests ?? []) {
        const resolvedBrandId = brandIdMap.get(fr.brandId);
        if (!resolvedBrandId) continue;
        await db.insert(brandFeatureRequests).values({
          brandId: resolvedBrandId,
          userId: req.userId,
          sheetRowIndex: fr.sheetRowIndex,
          date: fr.date,
          request: fr.request,
          response: fr.response,
          resolved: fr.resolved,
          syncStatus: fr.syncStatus,
        });
        importedFeatureRequests++;
      }

      return {
        ok: true as const,
        imported: {
          tasks: importedTasks,
          roles: importedRoles,
          dailyLogs: importedLogs,
          parkings: importedParkings,
          brands: importedBrands,
          brandStakeholders: importedStakeholders,
          brandMeetings: importedMeetings,
          brandActionItems: importedActionItems,
          brandFeatureRequests: importedFeatureRequests,
        },
      };
    },
  );
};
