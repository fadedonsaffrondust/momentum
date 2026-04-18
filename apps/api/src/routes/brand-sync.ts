import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import {
  syncCandidatesResponseSchema,
  syncLookupInputSchema,
  syncLookupResponseSchema,
  syncConfirmInputSchema,
  syncConfirmResponseSchema,
  updateSyncConfigInputSchema,
  type SyncConfig,
  type SyncMatchRules,
} from '@momentum/shared';
import { brands, brandStakeholders, brandMeetings, brandActionItems } from '@momentum/db';
import { db } from '../db.ts';
import { notFound } from '../errors.ts';
import { env } from '../env.ts';
import { TldvClient, TldvApiError } from '../services/tldv.ts';
import { categorizeCandidates } from '../services/meeting-scorer.ts';
import { extractMeetingContent, deduplicateActionItems, type DeduplicationResult } from '../services/meeting-extraction.ts';
import { matchAttendeeUserIds, type UserEmail } from '../lib/attendees.ts';
import { users as usersTable } from '@momentum/db';
import { isNull } from 'drizzle-orm';
import { recordBrandEvent } from '../services/events.ts';

const brandIdParam = z.object({ brandId: z.string().uuid() });

const DEFAULT_MATCH_RULES: SyncMatchRules = {
  stakeholderEmails: [],
  titleKeywords: [],
  meetingType: 'external',
  syncWindowDays: 30,
};

function getSyncConfig(raw: unknown): SyncConfig {
  const config = (raw ?? {}) as Partial<SyncConfig>;
  return {
    matchRules: { ...DEFAULT_MATCH_RULES, ...config.matchRules },
    syncedMeetingIds: config.syncedMeetingIds ?? [],
    lastSyncedAt: config.lastSyncedAt ?? null,
    lastSyncedMeetingDate: config.lastSyncedMeetingDate ?? null,
  };
}

export const brandSyncRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  // Fetch and score candidates from tldv
  app.post(
    '/brands/:brandId/sync/candidates',
    {
      schema: {
        params: brandIdParam,
        response: { 200: syncCandidatesResponseSchema },
      },
    },
    async (req) => {
      const tldvApiKey = env.TLDV_API_KEY;
      if (!tldvApiKey) {
        throw Object.assign(new Error('TLDV_API_KEY not configured on the server.'), {
          statusCode: 400,
        });
      }

      const [brand] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, req.params.brandId));
      if (!brand) throw notFound('Brand not found');

      const syncConfig = getSyncConfig(brand.syncConfig);
      const rules = syncConfig.matchRules;

      // Auto-populate stakeholder emails into rules
      const stakeholders = await db
        .select()
        .from(brandStakeholders)
        .where(eq(brandStakeholders.brandId, req.params.brandId));
      const stakeholderEmails = stakeholders
        .map((s) => s.email)
        .filter((e): e is string => !!e);
      const mergedEmails = [...new Set([...rules.stakeholderEmails, ...stakeholderEmails])];
      const mergedRules: SyncMatchRules = { ...rules, stakeholderEmails: mergedEmails };

      // Determine date range
      const fromDate =
        syncConfig.lastSyncedMeetingDate ??
        new Date(Date.now() - rules.syncWindowDays * 86_400_000).toISOString();
      const toDate = new Date().toISOString();

      const client = new TldvClient(tldvApiKey);

      // Fetch all pages of meetings
      const allMeetings: (typeof result.results)[number][] = [];
      let page = 1;
      let totalPages = 1;

      type MeetingItem = Awaited<ReturnType<typeof client.listMeetings>>['results'][number];
      const result = await client.listMeetings({
        meetingType: mergedRules.meetingType === 'both' ? undefined : mergedRules.meetingType,
        from: fromDate,
        to: toDate,
        limit: 50,
        page,
      });
      allMeetings.push(...result.results);
      totalPages = result.pages;

      while (page < totalPages && page < 5) {
        page++;
        const nextPage = await client.listMeetings({
          meetingType: mergedRules.meetingType === 'both' ? undefined : mergedRules.meetingType,
          from: fromDate,
          to: toDate,
          limit: 50,
          page,
        });
        allMeetings.push(...nextPage.results);
      }

      const { likely, possible } = categorizeCandidates(
        allMeetings,
        mergedRules,
        syncConfig.syncedMeetingIds,
      );

      return {
        likely,
        possible,
        lastSyncedAt: syncConfig.lastSyncedAt,
      };
    },
  );

  // Import selected meetings
  app.post(
    '/brands/:brandId/sync/confirm',
    {
      schema: {
        params: brandIdParam,
        body: syncConfirmInputSchema,
        response: { 200: syncConfirmResponseSchema },
      },
    },
    async (req) => {
      const tldvApiKey = env.TLDV_API_KEY;
      const openaiKey = env.OPENAI_API_KEY;
      if (!tldvApiKey) {
        throw Object.assign(new Error('TLDV_API_KEY not configured on the server.'), {
          statusCode: 400,
        });
      }

      const [brand] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, req.params.brandId));
      if (!brand) throw notFound('Brand not found');

      const syncConfig = getSyncConfig(brand.syncConfig);
      const stakeholders = await db
        .select()
        .from(brandStakeholders)
        .where(eq(brandStakeholders.brandId, req.params.brandId));

      // Load active team roster once — reused for attendee-linking on every
      // meeting imported in this confirm batch.
      const teamUsers: UserEmail[] = await db
        .select({ id: usersTable.id, email: usersTable.email })
        .from(usersTable)
        .where(isNull(usersTable.deactivatedAt));

      const client = new TldvClient(tldvApiKey);
      let imported = 0;
      let pendingTranscripts = 0;
      const errors: string[] = [];
      const newSyncedIds = [...syncConfig.syncedMeetingIds];
      let latestMeetingDate = syncConfig.lastSyncedMeetingDate;
      let aiExtracted = 0;
      let aiCreated = 0;
      let aiSkipped = 0;
      let aiUpdated = 0;

      const existingActionItems = await db
        .select({
          id: brandActionItems.id,
          text: brandActionItems.text,
          owner: brandActionItems.owner,
        })
        .from(brandActionItems)
        .where(
          and(
            eq(brandActionItems.brandId, req.params.brandId),
            eq(brandActionItems.status, 'open'),
          ),
        );

      for (const meetingId of req.body.meetingIds) {
        try {
          // Skip if already synced
          if (newSyncedIds.includes(meetingId)) continue;

          const meeting = await client.getMeeting(meetingId);
          const [transcript, highlights] = await Promise.all([
            client.getTranscript(meetingId),
            client.getHighlights(meetingId),
          ]);

          const meetingDate = meeting.happenedAt.slice(0, 10);
          let summary: string | null = null;
          let extractedActions: { text: string; owner: string }[] = [];
          let extractedDecisions: string[] = [];
          let rawNotesContent = '';

          // Build raw notes from transcript
          if (transcript.data.length > 0) {
            rawNotesContent = transcript.data
              .map((s) => `${s.speaker}: ${s.text}`)
              .join('\n');
          }

          // Run OpenAI extraction if API key and transcript available
          if (openaiKey && transcript.data.length > 0) {
            try {
              const extraction = await extractMeetingContent(
                openaiKey,
                brand.name,
                stakeholders.map((s) => ({ name: s.name, role: s.role })),
                meeting.invitees,
                transcript.data,
                highlights.data,
              );
              summary = extraction.summary;
              extractedActions = extraction.actionItems;
              extractedDecisions = extraction.decisions;
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : 'OpenAI extraction failed';
              app.log.error({ meetingId, err }, 'OpenAI extraction failed');
              errors.push(`Extraction failed for "${meeting.name}": ${msg.slice(0, 200)}`);
            }
          } else if (transcript.data.length === 0) {
            summary = 'Transcript still processing — re-sync later to extract content';
            pendingTranscripts++;
          }

          // Check for existing meeting note on same date (merge-or-create)
          const [existing] = await db
            .select()
            .from(brandMeetings)
            .where(
              and(
                eq(brandMeetings.brandId, req.params.brandId),
                eq(brandMeetings.date, meetingDate),
              ),
            );

          let targetMeetingId: string | undefined;
          let targetMeetingTitle: string = meeting.name;

          if (existing) {
            // Merge into existing note
            const separator = `\n\n---\n\n### ${meeting.name} (from recording)\n\n`;
            const mergedNotes = existing.rawNotes + separator + rawNotesContent;
            const mergedDecisions = [
              ...(existing.decisions ?? []),
              ...extractedDecisions,
            ];
            const mergedAttendees = [
              ...new Set([
                ...(existing.attendees ?? []),
                ...meeting.invitees.map((i) => i.name || i.email),
              ]),
            ];
            const mergedSummary = existing.summary
              ? `${existing.summary}\n\n${summary ?? ''}`
              : summary;
            const mergedAttendeeUserIds = matchAttendeeUserIds(mergedAttendees, teamUsers);

            await db
              .update(brandMeetings)
              .set({
                rawNotes: mergedNotes.slice(0, 100_000),
                summary: mergedSummary?.slice(0, 10_000) ?? null,
                decisions: mergedDecisions,
                attendees: mergedAttendees,
                attendeeUserIds: mergedAttendeeUserIds,
                recordingUrl: existing.recordingUrl ?? meeting.url,
                externalMeetingId: existing.externalMeetingId
                  ? `${existing.externalMeetingId},${meetingId}`
                  : meetingId,
              })
              .where(eq(brandMeetings.id, existing.id));
            targetMeetingId = existing.id;
            targetMeetingTitle = existing.title;
          } else {
            // Create new meeting note
            const newAttendees = meeting.invitees.map((i) => i.name || i.email);
            const newAttendeeUserIds = matchAttendeeUserIds(newAttendees, teamUsers);
            const [newMeeting] = await db
              .insert(brandMeetings)
              .values({
                brandId: req.params.brandId,
                date: meetingDate,
                title: meeting.name,
                attendees: newAttendees,
                attendeeUserIds: newAttendeeUserIds,
                summary: summary?.slice(0, 10_000) ?? null,
                rawNotes: rawNotesContent.slice(0, 100_000),
                decisions: extractedDecisions,
                source: 'recording_sync',
                externalMeetingId: meetingId,
                recordingUrl: meeting.url,
              })
              .returning({ id: brandMeetings.id });
            targetMeetingId = newMeeting?.id;
          }

          if (targetMeetingId && extractedActions.length > 0) {
            aiExtracted += extractedActions.length;

            let dedupResult: DeduplicationResult = {
              toCreate: extractedActions.map((a) => ({
                text: a.text,
                owner: a.owner === 'unassigned' ? null : a.owner ?? null,
              })),
              toUpdate: [],
              toSkip: [],
            };

            if (openaiKey && existingActionItems.length > 0) {
              try {
                dedupResult = await deduplicateActionItems(
                  openaiKey,
                  extractedActions,
                  existingActionItems,
                );
              } catch (err) {
                app.log.error({ meetingId, err }, 'Action item dedup failed, inserting all');
              }
            }

            for (const item of dedupResult.toCreate) {
              const text = item.text?.trim();
              if (!text) continue;
              await db.insert(brandActionItems).values({
                brandId: req.params.brandId,
                creatorId: req.userId,
                meetingId: targetMeetingId,
                text: text.slice(0, 2000),
                owner: item.owner?.slice(0, 256) ?? null,
              });
              existingActionItems.push({ id: '', text, owner: item.owner });
            }

            for (const item of dedupResult.toUpdate) {
              await db
                .update(brandActionItems)
                .set({
                  text: item.text.slice(0, 2000),
                  owner: item.owner?.slice(0, 256) ?? null,
                })
                .where(eq(brandActionItems.id, item.existingId));
              const idx = existingActionItems.findIndex((e) => e.id === item.existingId);
              if (idx !== -1) {
                existingActionItems[idx] = { id: item.existingId, text: item.text, owner: item.owner };
              }
            }

            aiCreated += dedupResult.toCreate.length;
            aiSkipped += dedupResult.toSkip.length;
            aiUpdated += dedupResult.toUpdate.length;

            app.log.info(
              { meetingId, extracted: extractedActions.length, created: dedupResult.toCreate.length, skipped: dedupResult.toSkip.length, updated: dedupResult.toUpdate.length },
              'Action item dedup result',
            );
          }

          newSyncedIds.push(meetingId);
          imported++;

          // Track latest meeting date for next sync
          if (!latestMeetingDate || meetingDate > latestMeetingDate) {
            latestMeetingDate = meetingDate;
          }

          if (targetMeetingId) {
            await recordBrandEvent({
              brandId: req.params.brandId,
              actorId: req.userId,
              eventType: 'recording_synced',
              entityType: 'brand_meeting',
              entityId: targetMeetingId,
              payload: {
                title: targetMeetingTitle,
                externalMeetingId: meetingId,
                merged: Boolean(existing),
              },
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          if (err instanceof TldvApiError && err.status === 429) {
            errors.push(
              `Rate limit reached after syncing ${imported} meetings. Try again in a few minutes.`,
            );
            break;
          }
          app.log.error({ meetingId, err }, 'Failed to sync meeting');
          errors.push(`Failed to sync meeting ${meetingId}: ${msg.slice(0, 200)}`);
        }
      }

      // Update brand's syncConfig
      const updatedConfig: SyncConfig = {
        ...syncConfig,
        syncedMeetingIds: newSyncedIds,
        lastSyncedAt: new Date().toISOString(),
        lastSyncedMeetingDate: latestMeetingDate,
      };
      await db
        .update(brands)
        .set({ syncConfig: updatedConfig, updatedAt: new Date() })
        .where(eq(brands.id, req.params.brandId));

      return {
        imported,
        pendingTranscripts,
        errors,
        actionItemStats: {
          extracted: aiExtracted,
          created: aiCreated,
          skipped: aiSkipped,
          updated: aiUpdated,
        },
      };
    },
  );

  // Look up a single meeting by tldv URL or ID
  app.post(
    '/brands/:brandId/sync/lookup',
    {
      schema: {
        params: brandIdParam,
        body: syncLookupInputSchema,
        response: { 200: syncLookupResponseSchema },
      },
    },
    async (req) => {
      const tldvApiKey = env.TLDV_API_KEY;
      if (!tldvApiKey) {
        throw Object.assign(new Error('TLDV_API_KEY not configured on the server.'), {
          statusCode: 400,
        });
      }

      const [brand] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, req.params.brandId));
      if (!brand) throw notFound('Brand not found');

      const ref = req.body.meetingRef.trim();
      const urlMatch = ref.match(/\/meetings\/([^/?#]+)/);
      const meetingId = urlMatch ? urlMatch[1]! : ref;

      const client = new TldvClient(tldvApiKey);
      try {
        const meeting = await client.getMeeting(meetingId);
        return {
          meeting: {
            id: meeting.id,
            name: meeting.name,
            happenedAt: meeting.happenedAt,
            duration: meeting.duration,
            invitees: meeting.invitees,
            organizer: meeting.organizer,
            url: meeting.url,
          },
          score: 0,
          reasons: ['Manual link'],
          confidence: 'high' as const,
        };
      } catch (err) {
        if (err instanceof TldvApiError && err.status === 404) {
          throw Object.assign(new Error('Meeting not found. Check the URL or ID and try again.'), {
            statusCode: 404,
          });
        }
        throw err;
      }
    },
  );

  // Update sync config (matching rules)
  app.patch(
    '/brands/:brandId/sync/config',
    {
      schema: {
        params: brandIdParam,
        body: updateSyncConfigInputSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [brand] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, req.params.brandId));
      if (!brand) throw notFound('Brand not found');

      const current = getSyncConfig(brand.syncConfig);
      const updatedConfig: SyncConfig = {
        ...current,
        matchRules: { ...current.matchRules, ...req.body.matchRules },
      };

      await db
        .update(brands)
        .set({ syncConfig: updatedConfig, updatedAt: new Date() })
        .where(eq(brands.id, req.params.brandId));

      return { ok: true as const };
    },
  );
};
