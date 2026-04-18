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
    .default('#0FB848'),
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

/* ─────────────── brands ─────────────── */

export const brandStatusSchema = z.enum(['active', 'importing', 'import_failed']);
export type BrandStatus = z.infer<typeof brandStatusSchema>;

export const meetingSourceSchema = z.enum(['manual', 'recording_sync']);
export type MeetingSource = z.infer<typeof meetingSourceSchema>;

export const syncMatchRulesSchema = z.object({
  stakeholderEmails: z.array(z.string().email()).default([]),
  titleKeywords: z.array(z.string()).default([]),
  meetingType: z.enum(['external', 'internal', 'both']).default('external'),
  syncWindowDays: z.number().int().positive().default(30),
});
export type SyncMatchRules = z.infer<typeof syncMatchRulesSchema>;

export const syncConfigSchema = z.object({
  matchRules: syncMatchRulesSchema.default({}),
  syncedMeetingIds: z.array(z.string()).default([]),
  lastSyncedAt: z.string().datetime().nullable().default(null),
  lastSyncedMeetingDate: z.string().nullable().default(null),
});
export type SyncConfig = z.infer<typeof syncConfigSchema>;

export const featureRequestsColumnMappingSchema = z.object({
  date: z.number().int().nonnegative(),
  request: z.number().int().nonnegative(),
  response: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
});
export type FeatureRequestsColumnMapping = z.infer<typeof featureRequestsColumnMappingSchema>;

export const featureRequestsConfigSchema = z.object({
  sheetId: z.string(),
  sheetGid: z.string().default('0'),
  sheetUrl: z.string(),
  connected: z.boolean(),
  lastSyncedAt: z.string().datetime().nullable().default(null),
  columnMapping: featureRequestsColumnMappingSchema,
});
export type FeatureRequestsConfig = z.infer<typeof featureRequestsConfigSchema>;

export const brandSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(256),
  goals: z.string().max(10_000).nullable(),
  successDefinition: z.string().max(10_000).nullable(),
  customFields: z.record(z.unknown()).default({}),
  syncConfig: syncConfigSchema.nullable(),
  featureRequestsConfig: featureRequestsConfigSchema.nullable(),
  status: brandStatusSchema,
  importError: z.string().nullable(),
  importedFrom: z.string().max(64).nullable(),
  rawImportContent: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Brand = z.infer<typeof brandSchema>;

export const createBrandInputSchema = z.object({
  name: z.string().min(1).max(256),
  goals: z.string().max(10_000).nullable().optional(),
  successDefinition: z.string().max(10_000).nullable().optional(),
});
export type CreateBrandInput = z.infer<typeof createBrandInputSchema>;

export const updateBrandInputSchema = createBrandInputSchema.partial().strict();
export type UpdateBrandInput = z.infer<typeof updateBrandInputSchema>;

/* ─────────────── brand stakeholders ─────────────── */

export const brandStakeholderSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(256),
  email: z.string().email().max(320).nullable(),
  role: z.string().max(256).nullable(),
  notes: z.string().max(4000).nullable(),
  createdAt: z.string().datetime(),
});
export type BrandStakeholder = z.infer<typeof brandStakeholderSchema>;

export const createBrandStakeholderInputSchema = z.object({
  name: z.string().min(1).max(256),
  email: z.string().email().max(320).nullable().optional(),
  role: z.string().max(256).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});
export type CreateBrandStakeholderInput = z.infer<typeof createBrandStakeholderInputSchema>;

export const updateBrandStakeholderInputSchema = createBrandStakeholderInputSchema
  .partial()
  .strict();
export type UpdateBrandStakeholderInput = z.infer<typeof updateBrandStakeholderInputSchema>;

/* ─────────────── brand meetings ─────────────── */

export const brandMeetingSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  date: isoDateSchema,
  title: z.string().min(1).max(500),
  attendees: z.array(z.string()),
  summary: z.string().max(10_000).nullable(),
  rawNotes: z.string().max(100_000),
  decisions: z.array(z.string()),
  source: meetingSourceSchema,
  externalMeetingId: z.string().max(500).nullable(),
  recordingUrl: z.string().max(2000).nullable(),
  createdAt: z.string().datetime(),
});
export type BrandMeeting = z.infer<typeof brandMeetingSchema>;

export const createBrandMeetingInputSchema = z.object({
  date: isoDateSchema,
  title: z.string().min(1).max(500),
  attendees: z.array(z.string()).optional().default([]),
  summary: z.string().max(10_000).nullable().optional(),
  rawNotes: z.string().max(100_000),
  decisions: z.array(z.string()).optional().default([]),
});
export type CreateBrandMeetingInput = z.infer<typeof createBrandMeetingInputSchema>;

export const updateBrandMeetingInputSchema = createBrandMeetingInputSchema.partial().strict();
export type UpdateBrandMeetingInput = z.infer<typeof updateBrandMeetingInputSchema>;

/* ─────────────── brand action items ─────────────── */

export const brandActionStatusSchema = z.enum(['open', 'done']);
export type BrandActionStatus = z.infer<typeof brandActionStatusSchema>;

export const brandActionItemSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  meetingId: z.string().uuid().nullable(),
  userId: z.string().uuid(),
  text: z.string().min(1).max(2000),
  status: brandActionStatusSchema,
  owner: z.string().max(256).nullable(),
  dueDate: isoDateSchema.nullable(),
  linkedTaskId: z.string().uuid().nullable(),
  meetingDate: isoDateSchema.nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type BrandActionItem = z.infer<typeof brandActionItemSchema>;

export const createBrandActionItemInputSchema = z.object({
  text: z.string().min(1).max(2000),
  meetingId: z.string().uuid().nullable().optional(),
  owner: z.string().max(256).nullable().optional(),
  dueDate: isoDateSchema.nullable().optional(),
});
export type CreateBrandActionItemInput = z.infer<typeof createBrandActionItemInputSchema>;

export const updateBrandActionItemInputSchema = createBrandActionItemInputSchema
  .partial()
  .extend({ status: brandActionStatusSchema.optional() })
  .strict();
export type UpdateBrandActionItemInput = z.infer<typeof updateBrandActionItemInputSchema>;

/* ─────────────── brand feature requests ─────────────── */

export const featureRequestSyncStatusSchema = z.enum(['synced', 'pending', 'error']);
export type FeatureRequestSyncStatus = z.infer<typeof featureRequestSyncStatusSchema>;

export const brandFeatureRequestSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  sheetRowIndex: z.number().int().nonnegative().nullable(),
  date: z.string(),
  request: z.string().min(1).max(10_000),
  response: z.string().max(10_000).nullable(),
  resolved: z.boolean(),
  syncStatus: featureRequestSyncStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BrandFeatureRequest = z.infer<typeof brandFeatureRequestSchema>;

export const createBrandFeatureRequestInputSchema = z.object({
  date: z.string().min(1),
  request: z.string().min(1).max(10_000),
  response: z.string().max(10_000).nullable().optional(),
  resolved: z.boolean().optional(),
});
export type CreateBrandFeatureRequestInput = z.infer<typeof createBrandFeatureRequestInputSchema>;

export const updateBrandFeatureRequestInputSchema = createBrandFeatureRequestInputSchema
  .partial()
  .strict();
export type UpdateBrandFeatureRequestInput = z.infer<typeof updateBrandFeatureRequestInputSchema>;

export const convertFeatureRequestResponseSchema = z.object({
  featureRequest: brandFeatureRequestSchema,
  actionItem: brandActionItemSchema,
});
export type ConvertFeatureRequestResponse = z.infer<typeof convertFeatureRequestResponseSchema>;

export const connectSheetInputSchema = z.object({
  sheetUrl: z.string().min(1),
  sheetGid: z.string().optional(),
  standardize: z.boolean().default(true),
});
export type ConnectSheetInput = z.infer<typeof connectSheetInputSchema>;

export const connectSheetResponseSchema = z.object({
  config: featureRequestsConfigSchema,
  imported: z.number().int().nonnegative(),
  headers: z.object({
    original: z.array(z.string()),
    mapped: z.array(z.string()),
  }),
});
export type ConnectSheetResponse = z.infer<typeof connectSheetResponseSchema>;

export const sheetSyncPullResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});
export type SheetSyncPullResponse = z.infer<typeof sheetSyncPullResponseSchema>;

export const sheetSyncPushResponseSchema = z.object({
  pushed: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});
export type SheetSyncPushResponse = z.infer<typeof sheetSyncPushResponseSchema>;

/* ─────────────── brand sync ─────────────── */

export const syncCandidateSchema = z.object({
  meeting: z.object({
    id: z.string(),
    name: z.string(),
    happenedAt: z.string(),
    duration: z.number().optional(),
    invitees: z.array(z.object({ name: z.string(), email: z.string() })),
    organizer: z.object({ name: z.string(), email: z.string() }),
    url: z.string(),
  }),
  score: z.number(),
  reasons: z.array(z.string()),
  confidence: z.enum(['high', 'low']),
});
export type SyncCandidate = z.infer<typeof syncCandidateSchema>;

export const syncCandidatesResponseSchema = z.object({
  likely: z.array(syncCandidateSchema),
  possible: z.array(syncCandidateSchema),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type SyncCandidatesResponse = z.infer<typeof syncCandidatesResponseSchema>;

export const syncLookupInputSchema = z.object({
  meetingRef: z.string().min(1).max(500),
});
export type SyncLookupInput = z.infer<typeof syncLookupInputSchema>;

export const syncLookupResponseSchema = syncCandidateSchema;
export type SyncLookupResponse = z.infer<typeof syncLookupResponseSchema>;

export const syncConfirmInputSchema = z.object({
  meetingIds: z.array(z.string()).min(1),
});
export type SyncConfirmInput = z.infer<typeof syncConfirmInputSchema>;

export const syncConfirmResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  pendingTranscripts: z.number().int().nonnegative(),
  errors: z.array(z.string()),
  actionItemStats: z.object({
    extracted: z.number().int().nonnegative(),
    created: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
  }),
});
export type SyncConfirmResponse = z.infer<typeof syncConfirmResponseSchema>;

export const updateSyncConfigInputSchema = z.object({
  matchRules: syncMatchRulesSchema.partial(),
});
export type UpdateSyncConfigInput = z.infer<typeof updateSyncConfigInputSchema>;

/* ─────────────── brand import ─────────────── */

export const brandImportInputSchema = z.object({
  fileName: z.string().min(1),
  fileContent: z.string().min(1).max(100_000),
});
export type BrandImportInput = z.infer<typeof brandImportInputSchema>;

export const brandImportResponseSchema = z.object({
  brand: brandSchema,
});
export type BrandImportResponse = z.infer<typeof brandImportResponseSchema>;

/* ─────────────── export / import ─────────────── */

export const exportFileSchema = z.object({
  version: z.enum(['1.0', '1.1', '1.2', '1.3']),
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
  // Added in 1.2.
  brands: z.array(brandSchema.omit({ userId: true })).optional().default([]),
  brandStakeholders: z
    .array(brandStakeholderSchema.omit({ userId: true }))
    .optional()
    .default([]),
  brandMeetings: z
    .array(brandMeetingSchema.omit({ userId: true }))
    .optional()
    .default([]),
  brandActionItems: z
    .array(brandActionItemSchema.omit({ userId: true }))
    .optional()
    .default([]),
  // Added in 1.3.
  brandFeatureRequests: z
    .array(brandFeatureRequestSchema.omit({ userId: true }))
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
  '#0FB848', // green (brand)
  '#F7B24F', // amber
  '#4FD1C5', // teal
  '#F76C6C', // red
  '#B184F7', // purple
  '#4F8EF7', // blue
  '#F78FB3', // pink
  '#FFD93D', // yellow
] as const;
