import { z } from 'zod';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { tasks, users } from '@momentum/db';
import type { Task } from '@momentum/shared';
import { isoDateSchema } from '@momentum/shared';
import type { Tool } from './types.ts';

/* ─────────────── getTeamMembers ─────────────── */
//
// "Team" in Momentum is the single-tenant @omnirev.ai allowlist (v0.7.0
// Team Space). There is no explicit `team_members` table — every active
// user is a team member. Deactivated users are excluded because they
// can't log in and can't be assigned new work.

const getTeamMembersInputSchema = z.object({});

export type GetTeamMembersInput = z.infer<typeof getTeamMembersInputSchema>;
export interface TeamMemberSummary {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
  createdAt: string;
}
export type GetTeamMembersOutput = TeamMemberSummary[];

export const getTeamMembers: Tool<GetTeamMembersInput, GetTeamMembersOutput> = {
  name: 'getTeamMembers',
  description: [
    'Use when the user asks who is on the team, or needs to cross-reference a name — "who is on the team", "who did that action item go to".',
    'Returns active team members (id, email, display name, avatar color, joined-at). Deactivated accounts are excluded.',
    'Do not use to look up a specific person by name — the Team Roster is inlined into every system prompt, so you already have the id→name map without a tool call.',
  ].join(' '),
  inputSchema: getTeamMembersInputSchema,
  readOnly: true,
  async handler(_args, ctx) {
    const rows = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarColor: users.avatarColor,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deactivatedAt))
      .orderBy(asc(users.displayName));

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.displayName,
      avatarColor: r.avatarColor,
      createdAt: r.createdAt.toISOString(),
    }));
  },
};

/* ─────────────── getMemberTasks ─────────────── */

const getMemberTasksInputSchema = z.object({
  memberId: z.string().uuid(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type GetMemberTasksInput = z.infer<typeof getMemberTasksInputSchema>;
export type GetMemberTasksOutput = Omit<Task, 'description'>[];

export const getMemberTasks: Tool<GetMemberTasksInput, GetMemberTasksOutput> = {
  name: 'getMemberTasks',
  description: [
    'Use when the user asks what a specific team member is working on — "what is Sara doing today", "show me Ryan\'s in-progress tasks".',
    'Returns tasks assigned to that member, with the same shape as getMyTasks / getTasks but scoped to a single user.',
    "Do not use for the asker's own tasks (use getMyTasks) or when you want tasks across many members (use getTasks with no assignee filter).",
  ].join(' '),
  inputSchema: getMemberTasksInputSchema,
  readOnly: true,
  async handler(args, ctx) {
    const conditions = [eq(tasks.assigneeId, args.memberId)];
    if (args.status) conditions.push(eq(tasks.status, args.status));
    if (args.dateFrom) conditions.push(gte(tasks.scheduledDate, args.dateFrom));
    if (args.dateTo) conditions.push(lte(tasks.scheduledDate, args.dateTo));

    const rows = await ctx.db
      .select({
        id: tasks.id,
        creatorId: tasks.creatorId,
        assigneeId: tasks.assigneeId,
        title: tasks.title,
        roleId: tasks.roleId,
        priority: tasks.priority,
        estimateMinutes: tasks.estimateMinutes,
        actualMinutes: tasks.actualMinutes,
        status: tasks.status,
        column: tasks.column,
        scheduledDate: tasks.scheduledDate,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.scheduledDate), desc(tasks.priority), asc(tasks.createdAt))
      .limit(args.limit);

    return rows.map((row) => ({
      id: row.id,
      creatorId: row.creatorId,
      assigneeId: row.assigneeId,
      title: row.title,
      roleId: row.roleId,
      priority: row.priority,
      estimateMinutes: row.estimateMinutes,
      actualMinutes: row.actualMinutes,
      status: row.status,
      column: row.column,
      scheduledDate: row.scheduledDate,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    }));
  },
};
