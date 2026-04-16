import type { InferSelectModel } from 'drizzle-orm';
import type { tasks, roles, userSettings, dailyLogs, parkings } from '@momentum/db';
import type { Task, Role, UserSettings, DailyLog, Parking } from '@momentum/shared';

type DbTask = InferSelectModel<typeof tasks>;
type DbRole = InferSelectModel<typeof roles>;
type DbSettings = InferSelectModel<typeof userSettings>;
type DbDailyLog = InferSelectModel<typeof dailyLogs>;
type DbParking = InferSelectModel<typeof parkings>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const isoNonNull = (d: Date): string => d.toISOString();

export function mapTask(row: DbTask): Task {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    roleId: row.roleId,
    priority: row.priority,
    estimateMinutes: row.estimateMinutes,
    actualMinutes: row.actualMinutes,
    status: row.status,
    column: row.column,
    scheduledDate: row.scheduledDate,
    createdAt: isoNonNull(row.createdAt),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
  };
}

export function mapRole(row: DbRole): Role {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    position: row.position,
  };
}

export function mapSettings(row: DbSettings): UserSettings {
  return {
    userId: row.userId,
    dailyCapacityMinutes: row.dailyCapacityMinutes,
    theme: row.theme,
    userName: row.userName,
    lastExportDate: iso(row.lastExportDate),
    onboarded: row.onboarded,
  };
}

export function mapParking(row: DbParking): Parking {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    notes: row.notes,
    outcome: row.outcome,
    targetDate: row.targetDate,
    roleId: row.roleId,
    priority: row.priority,
    status: row.status,
    createdAt: isoNonNull(row.createdAt),
    discussedAt: iso(row.discussedAt),
  };
}

export function mapDailyLog(row: DbDailyLog): DailyLog {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    tasksPlanned: row.tasksPlanned,
    tasksCompleted: row.tasksCompleted,
    totalEstimatedMinutes: row.totalEstimatedMinutes,
    totalActualMinutes: row.totalActualMinutes,
    journalEntry: row.journalEntry,
    completionRate: row.completionRate,
  };
}
