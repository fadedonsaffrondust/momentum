import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, isNull } from 'drizzle-orm';
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
  brandEvents,
  inboxEvents,
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
  mapUserSummary,
  mapBrandEvent,
  mapInboxEvent,
} from '../mappers.ts';
import { notFound } from '../errors.ts';

export const dataRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /**
   * Team-space v1.4 export. Team-shared collections (brands/stakeholders/
   * meetings/action items/feature requests/roles) are wholesale; personal
   * collections (settings, daily logs) are still scoped to the actor.
   *
   * Events (brand_events + inbox_events) are included for snapshot fidelity
   * — they're NOT re-imported, but having them in the file preserves
   * history for downstream consumers (auditors, analytics).
   */
  app.get(
    '/export',
    {
      // /export iterates the entire team-shared dataset in memory, so
      // it's both expensive and a juicy target for scraping. Tighter limit
      // than the global default; keyed by JWT user id (not IP) so a NAT'd
      // office shares the budget per-account, not per-egress.
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '5 minutes',
          keyGenerator: (req) => (req as { userId?: string }).userId ?? req.ip,
        },
      },
      schema: { response: { 200: exportFileSchema } },
    },
    async (req) => {
      const [settingsRow] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, req.userId))
        .limit(1);
      if (!settingsRow) throw notFound('Settings not found');

      const roleRows = await db.select().from(roles);
      const taskRows = await db.select().from(tasks);
      const logRows = await db.select().from(dailyLogs).where(eq(dailyLogs.userId, req.userId));
      const parkingRows = await db.select().from(parkings);
      const brandRows = await db.select().from(brands);
      const stakeholderRows = await db.select().from(brandStakeholders);
      const meetingRows = await db.select().from(brandMeetings);
      const actionItemRows = await db.select().from(brandActionItems);
      const featureRequestRows = await db.select().from(brandFeatureRequests);

      // Active team roster for the v1.4 `users` collection (spec §5.10).
      const activeUserRows = await db.select().from(users).where(isNull(users.deactivatedAt));

      // Events: loaded without their hydrated actor (that's a display
      // concern). Each event row carries actor_id, and the export's
      // `users` collection lets consumers look up the UserSummary.
      const brandEventRows = await db.select().from(brandEvents);
      const inboxEventRows = await db
        .select()
        .from(inboxEvents)
        .where(eq(inboxEvents.userId, req.userId));

      const { userId: _ignoredUserId, ...settingsNoUser } = mapSettings(settingsRow);

      // Mark last export date.
      await db
        .update(userSettings)
        .set({ lastExportDate: new Date() })
        .where(eq(userSettings.userId, req.userId));

      // Build an actor lookup so event mapping can hydrate without a
      // second round-trip. If an event references a deactivated user we
      // still include them — historical events shouldn't vanish.
      const allUserRows = await db.select().from(users);
      const userById = new Map(allUserRows.map((u) => [u.id, u]));

      return {
        version: '1.4' as const,
        exportedAt: new Date().toISOString(),
        settings: settingsNoUser,
        roles: roleRows.map(mapRole),
        tasks: taskRows.map(mapTask),
        dailyLogs: logRows.map((l) => {
          const { userId: _u, ...rest } = mapDailyLog(l);
          return rest;
        }),
        parkings: parkingRows.map(mapParking),
        brands: brandRows.map(mapBrand),
        brandStakeholders: stakeholderRows.map(mapBrandStakeholder),
        brandMeetings: meetingRows.map(mapBrandMeeting),
        brandActionItems: actionItemRows.map(mapBrandActionItem),
        brandFeatureRequests: featureRequestRows.map(mapBrandFeatureRequest),
        users: activeUserRows.map(mapUserSummary),
        brandEvents: brandEventRows.flatMap((row) => {
          const actor = userById.get(row.actorId);
          return actor ? [mapBrandEvent(row, actor)] : [];
        }),
        inboxEvents: inboxEventRows.flatMap((row) => {
          const actor = userById.get(row.actorId);
          return actor ? [mapInboxEvent(row, actor)] : [];
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

      // Whole import runs in one transaction so a mid-stream failure
      // (failed insert, schema mismatch, ...) leaves the DB exactly as it
      // was before the request — no half-replaced team data, no orphaned
      // brands without their stakeholders.
      const imported = await db.transaction(async (tx) => {
        // Replace mode in team-space is destructive at the TEAM level —
        // wipes team-shared data for everyone. Daily logs + own-settings
        // are the only personal-scoped wipes. Per spec §4.4 (flat perms)
        // any authenticated user can trigger this; the UI is expected to
        // double-confirm before firing. No user_id filter on team tables.
        if (mode === 'replace') {
          await tx.delete(brandFeatureRequests);
          await tx.delete(brandActionItems);
          await tx.delete(brandMeetings);
          await tx.delete(brandStakeholders);
          await tx.delete(brands);
          await tx.delete(parkings);
          await tx.delete(tasks);
          await tx.delete(dailyLogs).where(eq(dailyLogs.userId, req.userId));
          await tx.delete(roles);
        }

        // Apply settings (always merge — personal scope).
        await tx
          .update(userSettings)
          .set({
            dailyCapacityMinutes: file.settings.dailyCapacityMinutes,
            theme: file.settings.theme,
            userName: file.settings.userName,
            onboarded: file.settings.onboarded,
          })
          .where(eq(userSettings.userId, req.userId));

        const roleIdMap = new Map<string, string>();
        let importedRoles = 0;
        for (const r of file.roles) {
          const [inserted] = await tx
            .insert(roles)
            .values({
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
          await tx.insert(tasks).values({
            // Backward-compat: v1.0–1.3 files don't carry creator/assignee
            // ids — those tasks were previously user-scoped to the exporter.
            // Default both to the importer so the task still "belongs" to
            // them. v1.4 files preserve the original ids verbatim.
            creatorId: t.creatorId ?? req.userId,
            assigneeId: t.assigneeId ?? req.userId,
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
          await tx
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

        let importedParkings = 0;
        for (const p of file.parkings ?? []) {
          await tx.insert(parkings).values({
            // Backward-compat defaults per spec §5.10.
            creatorId: p.creatorId ?? req.userId,
            title: p.title,
            notes: p.notes,
            outcome: p.outcome,
            targetDate: p.targetDate,
            roleId: p.roleId ? (roleIdMap.get(p.roleId) ?? null) : null,
            priority: p.priority,
            status: p.status,
            visibility: p.visibility ?? 'private',
            involvedIds: p.involvedIds ?? [],
            discussedAt: p.discussedAt ? new Date(p.discussedAt) : null,
          });
          importedParkings++;
        }

        const brandIdMap = new Map<string, string>();
        let importedBrands = 0;
        for (const b of file.brands ?? []) {
          const [inserted] = await tx
            .insert(brands)
            .values({
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
          await tx.insert(brandStakeholders).values({
            brandId: resolvedBrandId,
            name: s.name,
            email: s.email,
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
          const [inserted] = await tx
            .insert(brandMeetings)
            .values({
              brandId: resolvedBrandId,
              date: m.date,
              title: m.title,
              attendees: m.attendees,
              // v1.4 preserves attendee_user_ids; v1.0–1.3 didn't have the
              // column — default to empty (frontend still renders the
              // plain-text attendee list via `attendees`).
              attendeeUserIds: m.attendeeUserIds ?? [],
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
          await tx.insert(brandActionItems).values({
            brandId: resolvedBrandId,
            creatorId: a.creatorId ?? req.userId,
            // assigneeId may be explicitly null in v1.4 (unassigned) — keep
            // as null. If absent from an older file, also null.
            assigneeId: a.assigneeId ?? null,
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
          await tx.insert(brandFeatureRequests).values({
            brandId: resolvedBrandId,
            sheetRowIndex: fr.sheetRowIndex,
            date: fr.date,
            request: fr.request,
            response: fr.response,
            resolved: fr.resolved,
            syncStatus: fr.syncStatus,
          });
          importedFeatureRequests++;
        }

        // NOTE: v1.4 `users`, `brandEvents`, and `inboxEvents` collections
        // are intentionally NOT imported. Users are managed by the auth
        // route's signup flow; events are mutable activity history that
        // would create duplicates if replayed. The collections exist in
        // the export file for snapshot fidelity only.

        return {
          tasks: importedTasks,
          roles: importedRoles,
          dailyLogs: importedLogs,
          parkings: importedParkings,
          brands: importedBrands,
          brandStakeholders: importedStakeholders,
          brandMeetings: importedMeetings,
          brandActionItems: importedActionItems,
          brandFeatureRequests: importedFeatureRequests,
        };
      });

      return { ok: true as const, imported };
    },
  );
};
