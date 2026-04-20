import { sql } from 'drizzle-orm';
import type { Database } from '@momentum/db';
import { brandActionItems, brandMeetings, brands, tasks, users } from '@momentum/db';

/**
 * Deterministic seed for the eval harness. Uses fixed UUIDs in the
 * reserved `00000000-0000-0000-0000-000000000XXX` range so they never
 * collide with `gen_random_uuid()` values from normal writes.
 *
 * The runner runs everything inside a Drizzle transaction that rolls
 * back at the end (see runner.ts), so these inserts never persist past
 * an eval run — safe to point the runner at any Postgres the dev has
 * handy without mutating real data.
 */

export const EVAL_IDS = {
  users: {
    nader: '00000000-0000-0000-0000-00000000a001',
    sara: '00000000-0000-0000-0000-00000000a002',
    ryan: '00000000-0000-0000-0000-00000000a003',
  },
  brands: {
    boudin: '00000000-0000-0000-0000-00000000b001',
    chipotle: '00000000-0000-0000-0000-00000000b002',
  },
  tasks: {
    naderToday: '00000000-0000-0000-0000-00000000c001',
    naderInProgress: '00000000-0000-0000-0000-00000000c002',
    naderTomorrow: '00000000-0000-0000-0000-00000000c003',
    naderDoneYesterday: '00000000-0000-0000-0000-00000000c004',
    saraInProgress: '00000000-0000-0000-0000-00000000c005',
    ryanInProgress: '00000000-0000-0000-0000-00000000c006',
  },
  actionItems: {
    boudinOverdue: '00000000-0000-0000-0000-00000000d001',
    boudinOpen: '00000000-0000-0000-0000-00000000d002',
    chipotleDone: '00000000-0000-0000-0000-00000000d003',
  },
  meetings: {
    boudinRecent: '00000000-0000-0000-0000-00000000e001',
  },
} as const;

/**
 * Call once per eval run inside a transaction. Returns the same id
 * maps as `EVAL_IDS` for ergonomics; callers can destructure in one
 * go alongside fixture IDs.
 */
export async function seedEvalFixtures(db: Database): Promise<typeof EVAL_IDS> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Ten days ago — "overdue" against today.
  const tenDaysAgoIso = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await db.insert(users).values([
    {
      id: EVAL_IDS.users.nader,
      email: 'eval-nader@eval.test',
      passwordHash: 'n/a',
      displayName: 'Nader (eval)',
      avatarColor: '#0FB848',
    },
    {
      id: EVAL_IDS.users.sara,
      email: 'eval-sara@eval.test',
      passwordHash: 'n/a',
      displayName: 'Sara (eval)',
      avatarColor: '#F59E0B',
    },
    {
      id: EVAL_IDS.users.ryan,
      email: 'eval-ryan@eval.test',
      passwordHash: 'n/a',
      displayName: 'Ryan (eval)',
      avatarColor: '#3B82F6',
    },
  ]);

  await db.insert(brands).values([
    {
      id: EVAL_IDS.brands.boudin,
      name: 'Boudin (eval)',
      status: 'active',
      goals: 'Grow catering revenue 20% QoQ.',
      successDefinition: 'Weekly ops check-in, 90%+ platform usage.',
    },
    {
      id: EVAL_IDS.brands.chipotle,
      name: 'Chipotle (eval)',
      status: 'active',
      goals: 'Scale catering outreach across 1,500 locations.',
      successDefinition: null,
    },
  ]);

  await db.insert(tasks).values([
    {
      id: EVAL_IDS.tasks.naderToday,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.nader,
      title: 'Ship Jarvis eval harness',
      priority: 'high',
      status: 'todo',
      column: 'up_next',
      scheduledDate: todayIso,
    },
    {
      id: EVAL_IDS.tasks.naderInProgress,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.nader,
      title: 'Draft QBR deck for Boudin',
      priority: 'high',
      status: 'in_progress',
      column: 'in_progress',
      scheduledDate: todayIso,
      startedAt: sql`now()`,
    },
    {
      id: EVAL_IDS.tasks.naderTomorrow,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.nader,
      title: 'Send follow-up email to Chipotle catering lead',
      priority: 'medium',
      status: 'todo',
      column: 'up_next',
      scheduledDate: tomorrowIso,
    },
    {
      id: EVAL_IDS.tasks.naderDoneYesterday,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.nader,
      title: 'Review Sara sequence edits',
      priority: 'medium',
      status: 'done',
      column: 'done',
      scheduledDate: yesterdayIso,
      completedAt: sql`now() - interval '1 day'`,
    },
    {
      id: EVAL_IDS.tasks.saraInProgress,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.sara,
      title: 'Run dormant-contact activation on Boudin',
      priority: 'high',
      status: 'in_progress',
      column: 'in_progress',
      scheduledDate: todayIso,
    },
    {
      id: EVAL_IDS.tasks.ryanInProgress,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.ryan,
      title: 'Wire Chipotle deliverability monitoring',
      priority: 'medium',
      status: 'in_progress',
      column: 'in_progress',
      scheduledDate: todayIso,
    },
  ]);

  await db.insert(brandMeetings).values([
    {
      id: EVAL_IDS.meetings.boudinRecent,
      brandId: EVAL_IDS.brands.boudin,
      date: yesterdayIso,
      title: 'Boudin weekly ops sync',
      attendees: ['Nader', 'Ava Operator'],
      attendeeUserIds: [EVAL_IDS.users.nader],
      summary: 'Reviewed last week cohort + agreed on a QBR slot.',
      rawNotes: 'Boudin ops discussed usage dip + next steps.',
      decisions: ['Push QBR deck by Friday', 'Start Tuesday sequence'],
      source: 'manual',
    },
  ]);

  await db.insert(brandActionItems).values([
    {
      id: EVAL_IDS.actionItems.boudinOverdue,
      brandId: EVAL_IDS.brands.boudin,
      meetingId: EVAL_IDS.meetings.boudinRecent,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.nader,
      text: 'Send QBR deck to Boudin',
      status: 'open',
      dueDate: tenDaysAgoIso,
    },
    {
      id: EVAL_IDS.actionItems.boudinOpen,
      brandId: EVAL_IDS.brands.boudin,
      meetingId: EVAL_IDS.meetings.boudinRecent,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.sara,
      text: 'Kick off Tuesday sequence',
      status: 'open',
      dueDate: tomorrowIso,
    },
    {
      id: EVAL_IDS.actionItems.chipotleDone,
      brandId: EVAL_IDS.brands.chipotle,
      creatorId: EVAL_IDS.users.nader,
      assigneeId: EVAL_IDS.users.ryan,
      text: 'Ship deliverability dashboard',
      status: 'done',
      dueDate: yesterdayIso,
    },
  ]);

  return EVAL_IDS;
}
