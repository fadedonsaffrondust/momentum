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
} from 'drizzle-orm/pg-core';

/* ─────────────── enums ─────────────── */

export const priorityEnum = pgEnum('priority', ['high', 'medium', 'low']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done']);
export const taskColumnEnum = pgEnum('task_column', ['up_next', 'in_progress', 'done']);
export const themeEnum = pgEnum('theme', ['dark', 'light']);
export const parkingStatusEnum = pgEnum('parking_status', ['open', 'discussed', 'archived']);

/* ─────────────── users ─────────────── */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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

/* ─────────────── roles ─────────────── */

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#4F8EF7'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userRolesIdx: index('roles_user_id_idx').on(t.userId),
  }),
);

/* ─────────────── tasks ─────────────── */

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
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
    userIdIdx: index('tasks_user_id_idx').on(t.userId),
    scheduledIdx: index('tasks_scheduled_date_idx').on(t.userId, t.scheduledDate),
    statusIdx: index('tasks_status_idx').on(t.userId, t.status),
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    outcome: text('outcome'),
    targetDate: date('target_date'),
    roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
    priority: priorityEnum('priority').notNull().default('medium'),
    status: parkingStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    discussedAt: timestamp('discussed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdIdx: index('parkings_user_id_idx').on(t.userId),
    targetDateIdx: index('parkings_target_date_idx').on(t.userId, t.targetDate),
    statusIdx: index('parkings_status_idx').on(t.userId, t.status),
  }),
);

/* ─────────────── helper: force sql import not to tree-shake ─────────────── */
export const _sql = sql;
