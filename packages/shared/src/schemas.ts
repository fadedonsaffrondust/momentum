import { z } from 'zod';

/* ─────────────── primitives ─────────────── */

export const prioritySchema = z.enum(['high', 'medium', 'low']);
export type Priority = z.infer<typeof prioritySchema>;

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskColumnSchema = z.enum(['up_next', 'in_progress', 'done']);
export type TaskColumn = z.infer<typeof taskColumnSchema>;

export const themeSchema = z.enum(['dark', 'light']);
export type Theme = z.infer<typeof themeSchema>;

/** ISO date string (YYYY-MM-DD). */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/* ─────────────── role ─────────────── */

export const roleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#4F8EF7'),
  position: z.number().int().nonnegative(),
});
export type Role = z.infer<typeof roleSchema>;

export const createRoleInputSchema = roleSchema.pick({ name: true, color: true }).partial({
  color: true,
});
export type CreateRoleInput = z.infer<typeof createRoleInputSchema>;

/* ─────────────── task ─────────────── */

export const taskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(500),
  roleId: z.string().uuid().nullable(),
  priority: prioritySchema,
  estimateMinutes: z.number().int().nonnegative().nullable(),
  actualMinutes: z.number().int().nonnegative().nullable(),
  status: taskStatusSchema,
  column: taskColumnSchema,
  scheduledDate: isoDateSchema.nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskInputSchema = z.object({
  title: z.string().min(1).max(500),
  roleId: z.string().uuid().nullable().optional(),
  priority: prioritySchema.optional(),
  estimateMinutes: z.number().int().nonnegative().nullable().optional(),
  scheduledDate: isoDateSchema.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const updateTaskInputSchema = createTaskInputSchema
  .partial()
  .extend({
    status: taskStatusSchema.optional(),
    column: taskColumnSchema.optional(),
    actualMinutes: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

/* ─────────────── settings ─────────────── */

export const userSettingsSchema = z.object({
  userId: z.string().uuid(),
  dailyCapacityMinutes: z.number().int().positive().default(480),
  theme: themeSchema.default('dark'),
  userName: z.string().min(1).max(64),
  lastExportDate: z.string().datetime().nullable(),
  onboarded: z.boolean().default(false),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const updateSettingsInputSchema = userSettingsSchema
  .pick({
    dailyCapacityMinutes: true,
    theme: true,
    userName: true,
    onboarded: true,
  })
  .partial()
  .strict();
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

/* ─────────────── daily log ─────────────── */

export const dailyLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: isoDateSchema,
  tasksPlanned: z.number().int().nonnegative(),
  tasksCompleted: z.number().int().nonnegative(),
  totalEstimatedMinutes: z.number().int().nonnegative(),
  totalActualMinutes: z.number().int().nonnegative(),
  journalEntry: z.string().max(4000).nullable(),
  completionRate: z.number().min(0).max(1),
});
export type DailyLog = z.infer<typeof dailyLogSchema>;

export const upsertDailyLogInputSchema = z.object({
  date: isoDateSchema,
  journalEntry: z.string().max(4000).nullable().optional(),
});
export type UpsertDailyLogInput = z.infer<typeof upsertDailyLogInputSchema>;

/* ─────────────── parkings ─────────────── */

export const parkingStatusSchema = z.enum(['open', 'discussed', 'archived']);
export type ParkingStatus = z.infer<typeof parkingStatusSchema>;

export const parkingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(500),
  notes: z.string().max(10_000).nullable(),
  outcome: z.string().max(10_000).nullable(),
  targetDate: isoDateSchema.nullable(),
  roleId: z.string().uuid().nullable(),
  priority: prioritySchema,
  status: parkingStatusSchema,
  createdAt: z.string().datetime(),
  discussedAt: z.string().datetime().nullable(),
});
export type Parking = z.infer<typeof parkingSchema>;

export const createParkingInputSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(10_000).nullable().optional(),
  outcome: z.string().max(10_000).nullable().optional(),
  targetDate: isoDateSchema.nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
  priority: prioritySchema.optional(),
});
export type CreateParkingInput = z.infer<typeof createParkingInputSchema>;

export const updateParkingInputSchema = createParkingInputSchema
  .partial()
  .extend({
    status: parkingStatusSchema.optional(),
  })
  .strict();
export type UpdateParkingInput = z.infer<typeof updateParkingInputSchema>;

/* ─────────────── stats ─────────────── */

export const weeklyStatsSchema = z.object({
  days: z.array(
    z.object({
      date: isoDateSchema,
      tasksCompleted: z.number().int().nonnegative(),
      tasksPlanned: z.number().int().nonnegative(),
      completionRate: z.number().min(0).max(1),
    }),
  ),
  averageCompletionRate: z.number().min(0).max(1),
  mostActiveRoleId: z.string().uuid().nullable(),
  estimationAccuracy: z.number().nullable(),
  streak: z.number().int().nonnegative(),
});
export type WeeklyStats = z.infer<typeof weeklyStatsSchema>;

/* ─────────────── auth ─────────────── */

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  userName: z.string().min(1).max(64),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/* ─────────────── export / import ─────────────── */

export const exportFileSchema = z.object({
  version: z.enum(['1.0', '1.1']),
  exportedAt: z.string().datetime(),
  settings: userSettingsSchema.omit({ userId: true }),
  roles: z.array(roleSchema.omit({ id: true }).extend({ id: z.string() })),
  tasks: z.array(
    taskSchema.omit({ userId: true, id: true }).extend({
      id: z.string(),
      roleId: z.string().nullable(),
    }),
  ),
  dailyLogs: z.array(
    dailyLogSchema.omit({ userId: true, id: true }).extend({ id: z.string() }),
  ),
  // Added in 1.1 — older files are treated as an empty list.
  parkings: z
    .array(
      parkingSchema.omit({ userId: true, id: true }).extend({
        id: z.string(),
        roleId: z.string().nullable(),
      }),
    )
    .optional()
    .default([]),
});
export type ExportFile = z.infer<typeof exportFileSchema>;

export const importModeSchema = z.enum(['replace', 'merge']);
export type ImportMode = z.infer<typeof importModeSchema>;

export const importRequestSchema = z.object({
  mode: importModeSchema,
  file: exportFileSchema,
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

/* ─────────────── role color palette ─────────────── */

export const ROLE_COLOR_PALETTE = [
  '#4F8EF7', // blue
  '#F7B24F', // amber
  '#4FD1C5', // teal
  '#F76C6C', // red
  '#B184F7', // purple
  '#6BCB77', // green
  '#F78FB3', // pink
  '#FFD93D', // yellow
] as const;
