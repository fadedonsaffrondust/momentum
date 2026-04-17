import type { InferSelectModel } from 'drizzle-orm';
import type {
  tasks,
  roles,
  userSettings,
  dailyLogs,
  parkings,
  brands,
  brandStakeholders,
  brandMeetings,
  brandActionItems,
} from '@momentum/db';
import type {
  Task,
  Role,
  UserSettings,
  DailyLog,
  Parking,
  Brand,
  BrandStakeholder,
  BrandMeeting,
  BrandActionItem,
  SyncConfig,
} from '@momentum/shared';

type DbTask = InferSelectModel<typeof tasks>;
type DbRole = InferSelectModel<typeof roles>;
type DbSettings = InferSelectModel<typeof userSettings>;
type DbDailyLog = InferSelectModel<typeof dailyLogs>;
type DbParking = InferSelectModel<typeof parkings>;
type DbBrand = InferSelectModel<typeof brands>;
type DbBrandStakeholder = InferSelectModel<typeof brandStakeholders>;
type DbBrandMeeting = InferSelectModel<typeof brandMeetings>;
type DbBrandActionItem = InferSelectModel<typeof brandActionItems>;

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

export function mapBrand(row: DbBrand): Brand {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    goals: row.goals,
    successDefinition: row.successDefinition,
    customFields: (row.customFields ?? {}) as Record<string, unknown>,
    syncConfig: (row.syncConfig as SyncConfig) ?? null,
    status: row.status,
    importError: row.importError,
    importedFrom: row.importedFrom,
    rawImportContent: row.rawImportContent,
    createdAt: isoNonNull(row.createdAt),
    updatedAt: isoNonNull(row.updatedAt),
  };
}

export function mapBrandStakeholder(row: DbBrandStakeholder): BrandStakeholder {
  return {
    id: row.id,
    brandId: row.brandId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    notes: row.notes,
    createdAt: isoNonNull(row.createdAt),
  };
}

export function mapBrandMeeting(row: DbBrandMeeting): BrandMeeting {
  return {
    id: row.id,
    brandId: row.brandId,
    userId: row.userId,
    date: row.date,
    title: row.title,
    attendees: row.attendees ?? [],
    summary: row.summary,
    rawNotes: row.rawNotes,
    decisions: row.decisions ?? [],
    source: row.source,
    externalMeetingId: row.externalMeetingId,
    recordingUrl: row.recordingUrl,
    createdAt: isoNonNull(row.createdAt),
  };
}

export function mapBrandActionItem(row: DbBrandActionItem & { meetingDate?: string | null }): BrandActionItem {
  return {
    id: row.id,
    brandId: row.brandId,
    meetingId: row.meetingId,
    userId: row.userId,
    text: row.text,
    status: row.status,
    owner: row.owner,
    dueDate: row.dueDate,
    linkedTaskId: row.linkedTaskId,
    meetingDate: row.meetingDate ?? null,
    createdAt: isoNonNull(row.createdAt),
    completedAt: iso(row.completedAt),
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
