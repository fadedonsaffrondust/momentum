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
  brandFeatureRequests,
  brandEvents,
  inboxEvents,
  users,
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
  BrandFeatureRequest,
  BrandEvent,
  BrandEventType,
  InboxEvent,
  InboxEventType,
  InboxEntitySummary,
  UserSummary,
  SyncConfig,
  FeatureRequestsConfig,
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
type DbBrandFeatureRequest = InferSelectModel<typeof brandFeatureRequests>;
type DbBrandEvent = InferSelectModel<typeof brandEvents>;
type DbInboxEvent = InferSelectModel<typeof inboxEvents>;
type DbUser = InferSelectModel<typeof users>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const isoNonNull = (d: Date): string => d.toISOString();

export function mapTask(row: DbTask): Task {
  return {
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
    creatorId: row.creatorId,
    title: row.title,
    notes: row.notes,
    outcome: row.outcome,
    targetDate: row.targetDate,
    roleId: row.roleId,
    priority: row.priority,
    status: row.status,
    visibility: row.visibility,
    involvedIds: row.involvedIds ?? [],
    createdAt: isoNonNull(row.createdAt),
    discussedAt: iso(row.discussedAt),
  };
}

export function mapBrand(row: DbBrand): Brand {
  return {
    id: row.id,
    name: row.name,
    goals: row.goals,
    successDefinition: row.successDefinition,
    customFields: (row.customFields ?? {}) as Record<string, unknown>,
    syncConfig: (row.syncConfig as SyncConfig) ?? null,
    featureRequestsConfig: (row.featureRequestsConfig as FeatureRequestsConfig) ?? null,
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
    date: row.date,
    title: row.title,
    attendees: row.attendees ?? [],
    attendeeUserIds: row.attendeeUserIds ?? [],
    summary: row.summary,
    rawNotes: row.rawNotes,
    decisions: row.decisions ?? [],
    source: row.source,
    externalMeetingId: row.externalMeetingId,
    recordingUrl: row.recordingUrl,
    createdAt: isoNonNull(row.createdAt),
  };
}

export function mapBrandActionItem(
  row: DbBrandActionItem & { meetingDate?: string | null },
): BrandActionItem {
  return {
    id: row.id,
    brandId: row.brandId,
    meetingId: row.meetingId,
    creatorId: row.creatorId,
    assigneeId: row.assigneeId,
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

export function mapBrandFeatureRequest(row: DbBrandFeatureRequest): BrandFeatureRequest {
  return {
    id: row.id,
    brandId: row.brandId,
    sheetRowIndex: row.sheetRowIndex,
    date: row.date,
    request: row.request,
    response: row.response,
    resolved: row.resolved,
    syncStatus: row.syncStatus,
    createdAt: isoNonNull(row.createdAt),
    updatedAt: isoNonNull(row.updatedAt),
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

export function mapUserSummary(row: DbUser): UserSummary {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarColor: row.avatarColor,
    deactivatedAt: iso(row.deactivatedAt),
  };
}

export function mapBrandEvent(row: DbBrandEvent, actor: DbUser): BrandEvent {
  return {
    id: row.id,
    brandId: row.brandId,
    actor: mapUserSummary(actor),
    eventType: row.eventType as BrandEventType,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: isoNonNull(row.createdAt),
  };
}

export function mapInboxEvent(
  row: DbInboxEvent,
  actor: DbUser,
  entity: InboxEntitySummary = null,
): InboxEvent {
  return {
    id: row.id,
    userId: row.userId,
    actor: mapUserSummary(actor),
    eventType: row.eventType as InboxEventType,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    entity,
    readAt: iso(row.readAt),
    createdAt: isoNonNull(row.createdAt),
  };
}
