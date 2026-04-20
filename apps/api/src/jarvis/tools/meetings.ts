import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { brandActionItems, brandMeetings } from '@momentum/db';
import type { BrandActionStatus, MeetingSource } from '@momentum/shared';
import type { Tool } from './types.ts';

/* ─────────────── getRecentMeetings ─────────────── */

const getRecentMeetingsInputSchema = z.object({
  brandId: z
    .string()
    .uuid()
    .optional()
    .describe('Scope to a specific brand. Omit to return meetings across all brands.'),
  limit: z.number().int().min(1).max(50).default(10),
});

export type GetRecentMeetingsInput = z.infer<typeof getRecentMeetingsInputSchema>;

export interface RecentMeetingSummary {
  id: string;
  brandId: string;
  title: string;
  date: string;
  source: MeetingSource;
  summary: string | null;
  createdAt: string;
}

export type GetRecentMeetingsOutput = RecentMeetingSummary[];

export const getRecentMeetings: Tool<GetRecentMeetingsInput, GetRecentMeetingsOutput> = {
  name: 'getRecentMeetings',
  description: [
    'Use when the user asks for recent meetings — "what meetings did we have this week", "what was the last call we had with anyone".',
    'Returns the most recent meetings newest-first (date DESC, then created_at DESC as tiebreaker), optionally scoped to one brand. Summary is included; full notes / action items are on getMeeting.',
    'Do not use for meetings on ONE brand across a date range (use getBrandMeetings).',
  ].join(' '),
  inputSchema: getRecentMeetingsInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const base = ctx.db
      .select({
        id: brandMeetings.id,
        brandId: brandMeetings.brandId,
        title: brandMeetings.title,
        date: brandMeetings.date,
        source: brandMeetings.source,
        summary: brandMeetings.summary,
        createdAt: brandMeetings.createdAt,
      })
      .from(brandMeetings);
    const q = args.brandId ? base.where(eq(brandMeetings.brandId, args.brandId)) : base;
    const rows = await q
      .orderBy(desc(brandMeetings.date), desc(brandMeetings.createdAt))
      .limit(args.limit);
    return rows.map((r) => ({
      id: r.id,
      brandId: r.brandId,
      title: r.title,
      date: r.date,
      source: r.source,
      summary: r.summary,
      createdAt: r.createdAt.toISOString(),
    }));
  },
};

/* ─────────────── getMeeting ─────────────── */

const getMeetingInputSchema = z.object({
  meetingId: z.string().uuid(),
});

export type GetMeetingInput = z.infer<typeof getMeetingInputSchema>;

export interface MeetingActionItem {
  id: string;
  text: string;
  status: BrandActionStatus;
  assigneeId: string | null;
  dueDate: string | null;
}

export interface MeetingDetail {
  id: string;
  brandId: string;
  title: string;
  date: string;
  attendees: string[];
  attendeeUserIds: string[];
  summary: string | null;
  rawNotes: string;
  decisions: string[];
  source: MeetingSource;
  externalMeetingId: string | null;
  recordingUrl: string | null;
  createdAt: string;
  actionItems: MeetingActionItem[];
}

export type GetMeetingOutput = MeetingDetail | null;

export const getMeeting: Tool<GetMeetingInput, GetMeetingOutput> = {
  name: 'getMeeting',
  description: [
    'Use when the user asks for the full content of one meeting — "what did we agree in the Boudin QBR", "show me the notes from last Tuesday\'s call".',
    'Returns the meeting record (attendees, summary, raw notes, decisions) plus the action items extracted from or linked to that meeting. Returns null when the id does not exist.',
    "Do not use for browsing meetings (use getBrandMeetings / getRecentMeetings) — this tool's response is heavy.",
  ].join(' '),
  inputSchema: getMeetingInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const rows = await ctx.db
      .select()
      .from(brandMeetings)
      .where(eq(brandMeetings.id, args.meetingId))
      .limit(1);
    const meeting = rows[0];
    if (!meeting) return null;

    const actionRows = await ctx.db
      .select({
        id: brandActionItems.id,
        text: brandActionItems.text,
        status: brandActionItems.status,
        assigneeId: brandActionItems.assigneeId,
        dueDate: brandActionItems.dueDate,
      })
      .from(brandActionItems)
      .where(
        and(
          eq(brandActionItems.meetingId, args.meetingId),
          // Brand match is redundant given meetingId is unique, but keeping
          // it makes the intent explicit.
          eq(brandActionItems.brandId, meeting.brandId),
        ),
      );

    return {
      id: meeting.id,
      brandId: meeting.brandId,
      title: meeting.title,
      date: meeting.date,
      attendees: meeting.attendees,
      attendeeUserIds: meeting.attendeeUserIds,
      summary: meeting.summary,
      rawNotes: meeting.rawNotes,
      decisions: meeting.decisions,
      source: meeting.source,
      externalMeetingId: meeting.externalMeetingId,
      recordingUrl: meeting.recordingUrl,
      createdAt: meeting.createdAt.toISOString(),
      actionItems: actionRows,
    };
  },
};
