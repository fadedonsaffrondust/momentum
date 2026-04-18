import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  boolean,
  pgEnum,
  real,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

/* ─────────────── enums ─────────────── */

export const priorityEnum = pgEnum('priority', ['high', 'medium', 'low']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done']);
export const taskColumnEnum = pgEnum('task_column', ['up_next', 'in_progress', 'done']);
export const themeEnum = pgEnum('theme', ['dark', 'light']);
export const parkingStatusEnum = pgEnum('parking_status', ['open', 'discussed', 'archived']);
export const parkingVisibilityEnum = pgEnum('parking_visibility', ['team', 'private']);
export const brandStatusEnum = pgEnum('brand_status', ['active', 'importing', 'import_failed']);
export const brandActionStatusEnum = pgEnum('brand_action_status', ['open', 'done']);
export const meetingSourceEnum = pgEnum('meeting_source', ['manual', 'recording_sync']);
export const featureRequestSyncStatusEnum = pgEnum('feature_request_sync_status', [
  'synced',
  'pending',
  'error',
]);

/* ─────────────── users ─────────────── */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull().default(''),
    avatarColor: text('avatar_color').notNull().default('#0FB848'),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('idx_users_active').on(t.id).where(sql`${t.deactivatedAt} IS NULL`),
  }),
);

/* ─────────────── user_settings ─────────────── */

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  dailyCapacityMinutes: integer('daily_capacity_minutes').notNull().default(480),
  theme: themeEnum('theme').notNull().default('dark'),
  userName: text('user_name').notNull(),
  lastExportDate: timestamp('last_export_date', { withTimezone: true }),
  onboarded: boolean('onboarded').notNull().default(false),
});

/* ─────────────── roles (team-wide in team-space) ─────────────── */

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#0FB848'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ─────────────── tasks ─────────────── */

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assigneeId: uuid('assignee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
    priority: priorityEnum('priority').notNull().default('medium'),
    estimateMinutes: integer('estimate_minutes'),
    actualMinutes: integer('actual_minutes'),
    status: taskStatusEnum('status').notNull().default('todo'),
    column: taskColumnEnum('column').notNull().default('up_next'),
    scheduledDate: date('scheduled_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    assigneeIdx: index('tasks_assignee_id_idx').on(t.assigneeId),
    creatorIdx: index('idx_tasks_creator').on(t.creatorId),
    scheduledIdx: index('idx_tasks_assignee_scheduled').on(t.assigneeId, t.scheduledDate),
    statusIdx: index('tasks_status_idx').on(t.assigneeId, t.status),
  }),
);

/* ─────────────── daily_logs ─────────────── */

export const dailyLogs = pgTable(
  'daily_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    tasksPlanned: integer('tasks_planned').notNull().default(0),
    tasksCompleted: integer('tasks_completed').notNull().default(0),
    totalEstimatedMinutes: integer('total_estimated_minutes').notNull().default(0),
    totalActualMinutes: integer('total_actual_minutes').notNull().default(0),
    journalEntry: text('journal_entry'),
    completionRate: real('completion_rate').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDateUnique: uniqueIndex('daily_logs_user_date_unique').on(t.userId, t.date),
  }),
);

/* ─────────────── parkings ─────────────── */

export const parkings = pgTable(
  'parkings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    outcome: text('outcome'),
    targetDate: date('target_date'),
    roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
    priority: priorityEnum('priority').notNull().default('medium'),
    status: parkingStatusEnum('status').notNull().default('open'),
    visibility: parkingVisibilityEnum('visibility').notNull().default('team'),
    involvedIds: uuid('involved_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    discussedAt: timestamp('discussed_at', { withTimezone: true }),
  },
  (t) => ({
    creatorIdx: index('parkings_creator_id_idx').on(t.creatorId),
    targetDateIdx: index('parkings_target_date_idx').on(t.creatorId, t.targetDate),
    statusIdx: index('parkings_status_idx').on(t.creatorId, t.status),
    visibilityIdx: index('idx_parkings_visibility').on(t.visibility),
    involvedIdx: index('idx_parkings_involved').using('gin', t.involvedIds),
  }),
);

/* ─────────────── brands (team-shared) ─────────────── */

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  goals: text('goals'),
  successDefinition: text('success_definition'),
  customFields: jsonb('custom_fields').notNull().default('{}'),
  syncConfig: jsonb('sync_config'),
  status: brandStatusEnum('status').notNull().default('active'),
  importError: text('import_error'),
  importedFrom: text('imported_from'),
  rawImportContent: text('raw_import_content'),
  featureRequestsConfig: jsonb('feature_requests_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ─────────────── brand stakeholders (team-shared) ─────────────── */

export const brandStakeholders = pgTable(
  'brand_stakeholders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    role: text('role'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdIdx: index('brand_stakeholders_brand_id_idx').on(t.brandId),
  }),
);

/* ─────────────── brand meetings (team-shared) ─────────────── */

export const brandMeetings = pgTable(
  'brand_meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    title: text('title').notNull(),
    attendees: text('attendees').array().notNull().default(sql`'{}'::text[]`),
    attendeeUserIds: uuid('attendee_user_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    summary: text('summary'),
    rawNotes: text('raw_notes').notNull().default(''),
    decisions: text('decisions').array().notNull().default(sql`'{}'::text[]`),
    source: meetingSourceEnum('source').notNull().default('manual'),
    externalMeetingId: text('external_meeting_id'),
    recordingUrl: text('recording_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdIdx: index('brand_meetings_brand_id_idx').on(t.brandId),
    dateIdx: index('brand_meetings_date_idx').on(t.brandId, t.date),
    attendeeUserIdx: index('idx_bm_attendee_users').using('gin', t.attendeeUserIds),
  }),
);

/* ─────────────── brand action items (team-shared, creator + assignee) ─────────────── */

export const brandActionItems = pgTable(
  'brand_action_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id').references(() => brandMeetings.id, { onDelete: 'set null' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    text: text('text').notNull(),
    status: brandActionStatusEnum('status').notNull().default('open'),
    owner: text('owner'),
    dueDate: date('due_date'),
    linkedTaskId: uuid('linked_task_id').references(() => tasks.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    brandIdIdx: index('brand_action_items_brand_id_idx').on(t.brandId),
    statusIdx: index('brand_action_items_status_idx').on(t.brandId, t.status),
    assigneeIdx: index('idx_bai_assignee').on(t.assigneeId),
  }),
);

/* ─────────────── brand feature requests (team-shared) ─────────────── */

export const brandFeatureRequests = pgTable(
  'brand_feature_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    sheetRowIndex: integer('sheet_row_index'),
    date: text('date').notNull(),
    request: text('request').notNull(),
    response: text('response'),
    resolved: boolean('resolved').notNull().default(false),
    syncStatus: featureRequestSyncStatusEnum('sync_status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdIdx: index('brand_feature_requests_brand_id_idx').on(t.brandId),
    syncStatusIdx: index('brand_feature_requests_sync_status_idx').on(t.brandId, t.syncStatus),
  }),
);

/* ─────────────── brand events (team-shared activity timeline) ─────────────── */

export const brandEvents = pgTable(
  'brand_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').notNull().default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandCreatedIdx: index('idx_be_brand_created').on(t.brandId, t.createdAt.desc()),
  }),
);

/* ─────────────── inbox events (per-recipient notifications) ─────────────── */

export const inboxEvents = pgTable(
  'inbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload').notNull().default('{}'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userReadIdx: index('idx_ie_user_read').on(t.userId, t.readAt, t.createdAt.desc()),
    entityIdx: index('idx_ie_entity').on(t.entityType, t.entityId),
  }),
);

/* ─────────────── helper: force sql import not to tree-shake ─────────────── */
export const _sql = sql;
