import { describe, it, expect } from 'vitest';
import {
  prioritySchema,
  taskStatusSchema,
  taskColumnSchema,
  themeSchema,
  isoDateSchema,
  roleSchema,
  createRoleInputSchema,
  taskSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  userSettingsSchema,
  updateSettingsInputSchema,
  dailyLogSchema,
  parkingStatusSchema,
  parkingVisibilitySchema,
  parkingSchema,
  createParkingInputSchema,
  updateParkingInputSchema,
  brandStatusSchema,
  brandSchema,
  brandMeetingSchema,
  createBrandMeetingInputSchema,
  brandActionStatusSchema,
  brandActionItemSchema,
  createBrandActionItemInputSchema,
  updateBrandActionItemInputSchema,
  sendActionItemToTodayInputSchema,
  exportFileSchema,
  importModeSchema,
  importRequestSchema,
  registerInputSchema,
  loginInputSchema,
  authUserSchema,
  userSummarySchema,
  updateMeInputSchema,
  inboxEventSchema,
  brandEventSchema,
  teamTaskListSchema,
  teamWeeklyStatsSchema,
  teamTodayStatsSchema,
  ROLE_COLOR_PALETTE,
} from './schemas.ts';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const DT = '2026-04-15T12:00:00.000Z';

/* ─────────────── primitives ─────────────── */

describe('primitives', () => {
  it('prioritySchema accepts valid values', () => {
    expect(prioritySchema.parse('high')).toBe('high');
    expect(prioritySchema.parse('medium')).toBe('medium');
    expect(prioritySchema.parse('low')).toBe('low');
  });

  it('prioritySchema rejects invalid', () => {
    expect(() => prioritySchema.parse('urgent')).toThrow();
  });

  it('taskStatusSchema accepts valid values', () => {
    expect(taskStatusSchema.parse('todo')).toBe('todo');
    expect(taskStatusSchema.parse('in_progress')).toBe('in_progress');
    expect(taskStatusSchema.parse('done')).toBe('done');
  });

  it('taskStatusSchema rejects invalid', () => {
    expect(() => taskStatusSchema.parse('pending')).toThrow();
  });

  it('taskColumnSchema accepts valid values', () => {
    expect(taskColumnSchema.parse('up_next')).toBe('up_next');
    expect(taskColumnSchema.parse('in_progress')).toBe('in_progress');
    expect(taskColumnSchema.parse('done')).toBe('done');
  });

  it('taskColumnSchema rejects invalid', () => {
    expect(() => taskColumnSchema.parse('backlog')).toThrow();
  });

  it('themeSchema accepts dark and light', () => {
    expect(themeSchema.parse('dark')).toBe('dark');
    expect(themeSchema.parse('light')).toBe('light');
  });

  it('themeSchema rejects invalid', () => {
    expect(() => themeSchema.parse('blue')).toThrow();
  });

  it('isoDateSchema accepts YYYY-MM-DD', () => {
    expect(isoDateSchema.parse('2026-04-15')).toBe('2026-04-15');
  });

  it('isoDateSchema rejects YYYY/MM/DD', () => {
    expect(() => isoDateSchema.parse('2026/04/15')).toThrow();
  });

  it('isoDateSchema rejects not-a-date', () => {
    expect(() => isoDateSchema.parse('not-a-date')).toThrow();
  });

  it('isoDateSchema rejects YYYY-M-D (no zero-padding)', () => {
    expect(() => isoDateSchema.parse('2026-4-5')).toThrow();
  });
});

/* ─────────────── role ─────────────── */

describe('roleSchema', () => {
  const validRole = { id: UUID, name: 'Product', color: '#FF0000', position: 0 };

  it('accepts a valid role', () => {
    expect(roleSchema.parse(validRole)).toEqual(validRole);
  });

  it('rejects empty name', () => {
    expect(() => roleSchema.parse({ ...validRole, name: '' })).toThrow();
  });

  it('rejects invalid hex color', () => {
    expect(() => roleSchema.parse({ ...validRole, color: 'red' })).toThrow();
    expect(() => roleSchema.parse({ ...validRole, color: '#GG0000' })).toThrow();
  });

  it('rejects negative position', () => {
    expect(() => roleSchema.parse({ ...validRole, position: -1 })).toThrow();
  });
});

describe('createRoleInputSchema', () => {
  it('requires name', () => {
    expect(() => createRoleInputSchema.parse({})).toThrow();
  });

  it('accepts name only (color is optional)', () => {
    const result = createRoleInputSchema.parse({ name: 'Design' });
    expect(result.name).toBe('Design');
    expect(result.color).toBeUndefined();
  });

  it('accepts name and color', () => {
    const result = createRoleInputSchema.parse({ name: 'Design', color: '#AABB00' });
    expect(result.color).toBe('#AABB00');
  });
});

/* ─────────────── task ─────────────── */

describe('taskSchema', () => {
  const UUID2 = 'b2ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
  const validTask = {
    id: UUID,
    creatorId: UUID,
    assigneeId: UUID2,
    title: 'Ship feature',
    description: null,
    roleId: null,
    priority: 'medium' as const,
    estimateMinutes: null,
    actualMinutes: null,
    status: 'todo' as const,
    column: 'up_next' as const,
    scheduledDate: null,
    createdAt: DT,
    startedAt: null,
    completedAt: null,
  };

  it('accepts a full valid task with creator and assignee', () => {
    expect(taskSchema.parse(validTask)).toEqual(validTask);
  });

  it('requires creatorId', () => {
    const { creatorId: _, ...withoutCreator } = validTask;
    expect(() => taskSchema.parse(withoutCreator)).toThrow();
  });

  it('requires assigneeId', () => {
    const { assigneeId: _, ...withoutAssignee } = validTask;
    expect(() => taskSchema.parse(withoutAssignee)).toThrow();
  });

  it('allows null scheduledDate, roleId, estimateMinutes, actualMinutes, description', () => {
    const result = taskSchema.parse(validTask);
    expect(result.scheduledDate).toBeNull();
    expect(result.roleId).toBeNull();
    expect(result.estimateMinutes).toBeNull();
    expect(result.actualMinutes).toBeNull();
    expect(result.description).toBeNull();
  });

  it('accepts a multiline description', () => {
    const result = taskSchema.parse({
      ...validTask,
      description: '## Definition of done\n- [ ] Tests pass\n- [ ] Demo sent',
    });
    expect(result.description).toContain('Definition of done');
  });

  it('requires createdAt as datetime', () => {
    expect(() => taskSchema.parse({ ...validTask, createdAt: 'not-a-date' })).toThrow();
  });
});

describe('createTaskInputSchema', () => {
  it('accepts only title', () => {
    const result = createTaskInputSchema.parse({ title: 'Do thing' });
    expect(result.title).toBe('Do thing');
  });

  it('requires title', () => {
    expect(() => createTaskInputSchema.parse({})).toThrow();
  });

  it('accepts all optional fields including assigneeId', () => {
    const input = {
      title: 'Do thing',
      roleId: UUID,
      priority: 'high' as const,
      estimateMinutes: 30,
      scheduledDate: '2026-04-15',
      assigneeId: UUID,
    };
    expect(createTaskInputSchema.parse(input)).toEqual(input);
  });

  it('rejects non-uuid assigneeId', () => {
    expect(() =>
      createTaskInputSchema.parse({ title: 'x', assigneeId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('accepts an optional description string', () => {
    const result = createTaskInputSchema.parse({
      title: 'x',
      description: 'Definition of done: ship it.',
    });
    expect(result.description).toBe('Definition of done: ship it.');
  });

  it('accepts null description to explicitly clear it', () => {
    const result = createTaskInputSchema.parse({ title: 'x', description: null });
    expect(result.description).toBeNull();
  });

  it('rejects a description over 20,000 characters', () => {
    const huge = 'a'.repeat(20_001);
    expect(() =>
      createTaskInputSchema.parse({ title: 'x', description: huge }),
    ).toThrow();
  });
});

describe('updateTaskInputSchema', () => {
  it('accepts all fields as optional', () => {
    expect(updateTaskInputSchema.parse({})).toEqual({});
  });

  it('rejects unknown keys (strict)', () => {
    expect(() => updateTaskInputSchema.parse({ unknownField: true })).toThrow();
  });

  it('accepts status and column extensions', () => {
    const result = updateTaskInputSchema.parse({ status: 'done', column: 'done' });
    expect(result.status).toBe('done');
    expect(result.column).toBe('done');
  });

  it('accepts assigneeId for reassignment', () => {
    const result = updateTaskInputSchema.parse({ assigneeId: UUID });
    expect(result.assigneeId).toBe(UUID);
  });
});

/* ─────────────── settings ─────────────── */

describe('userSettingsSchema', () => {
  const fullSettings = {
    userId: UUID,
    dailyCapacityMinutes: 360,
    theme: 'light' as const,
    userName: 'Nader',
    lastExportDate: null,
    onboarded: true,
  };

  it('accepts valid settings with all fields', () => {
    expect(userSettingsSchema.parse(fullSettings)).toEqual(fullSettings);
  });

  it('applies defaults for dailyCapacityMinutes, theme, and onboarded', () => {
    const result = userSettingsSchema.parse({
      userId: UUID,
      userName: 'Nader',
      lastExportDate: null,
    });
    expect(result.dailyCapacityMinutes).toBe(480);
    expect(result.theme).toBe('dark');
    expect(result.onboarded).toBe(false);
  });
});

describe('updateSettingsInputSchema', () => {
  it('accepts partial fields', () => {
    expect(updateSettingsInputSchema.parse({ theme: 'light' })).toEqual({ theme: 'light' });
  });

  it('rejects unknown keys (strict)', () => {
    expect(() => updateSettingsInputSchema.parse({ unknownField: 42 })).toThrow();
  });
});

/* ─────────────── daily log ─────────────── */

describe('dailyLogSchema', () => {
  const validLog = {
    id: UUID,
    userId: UUID,
    date: '2026-04-15',
    tasksPlanned: 5,
    tasksCompleted: 3,
    totalEstimatedMinutes: 120,
    totalActualMinutes: 100,
    journalEntry: null,
    completionRate: 0.6,
  };

  it('accepts a valid daily log', () => {
    expect(dailyLogSchema.parse(validLog)).toEqual(validLog);
  });

  it('rejects completionRate > 1', () => {
    expect(() => dailyLogSchema.parse({ ...validLog, completionRate: 1.5 })).toThrow();
  });

  it('rejects completionRate < 0', () => {
    expect(() => dailyLogSchema.parse({ ...validLog, completionRate: -0.1 })).toThrow();
  });
});

/* ─────────────── parking ─────────────── */

describe('parkingSchema + create/update', () => {
  const validParking = {
    id: UUID,
    creatorId: UUID,
    title: 'Discuss pricing',
    notes: null,
    outcome: null,
    targetDate: null,
    roleId: null,
    priority: 'medium' as const,
    status: 'open' as const,
    visibility: 'team' as const,
    involvedIds: [],
    createdAt: DT,
    discussedAt: null,
  };

  it('parkingStatusSchema accepts valid values', () => {
    expect(parkingStatusSchema.parse('open')).toBe('open');
    expect(parkingStatusSchema.parse('discussed')).toBe('discussed');
    expect(parkingStatusSchema.parse('archived')).toBe('archived');
  });

  it('parkingStatusSchema rejects invalid', () => {
    expect(() => parkingStatusSchema.parse('closed')).toThrow();
  });

  it('parkingVisibilitySchema accepts team and private', () => {
    expect(parkingVisibilitySchema.parse('team')).toBe('team');
    expect(parkingVisibilitySchema.parse('private')).toBe('private');
  });

  it('parkingVisibilitySchema rejects invalid', () => {
    expect(() => parkingVisibilitySchema.parse('public')).toThrow();
  });

  it('accepts a valid parking with creator and visibility', () => {
    expect(parkingSchema.parse(validParking)).toEqual(validParking);
  });

  it('accepts a parking with involvedIds populated', () => {
    const withInvolved = { ...validParking, involvedIds: [UUID] };
    expect(parkingSchema.parse(withInvolved).involvedIds).toEqual([UUID]);
  });

  it('rejects non-uuid in involvedIds', () => {
    expect(() =>
      parkingSchema.parse({ ...validParking, involvedIds: ['not-a-uuid'] }),
    ).toThrow();
  });

  it('createParkingInputSchema requires title', () => {
    expect(() => createParkingInputSchema.parse({})).toThrow();
  });

  it('createParkingInputSchema accepts title only', () => {
    const result = createParkingInputSchema.parse({ title: 'Topic' });
    expect(result.title).toBe('Topic');
  });

  it('createParkingInputSchema accepts visibility and involvedIds', () => {
    const input = {
      title: 'Topic',
      visibility: 'private' as const,
      involvedIds: [UUID],
    };
    expect(createParkingInputSchema.parse(input)).toEqual(input);
  });

  it('updateParkingInputSchema accepts empty (all optional)', () => {
    expect(updateParkingInputSchema.parse({})).toEqual({});
  });

  it('updateParkingInputSchema accepts status extension', () => {
    const result = updateParkingInputSchema.parse({ status: 'discussed' });
    expect(result.status).toBe('discussed');
  });

  it('updateParkingInputSchema accepts visibility toggle', () => {
    const result = updateParkingInputSchema.parse({ visibility: 'private' });
    expect(result.visibility).toBe('private');
  });

  it('updateParkingInputSchema rejects unknown keys (strict)', () => {
    expect(() => updateParkingInputSchema.parse({ unknownField: true })).toThrow();
  });
});

/* ─────────────── brand ─────────────── */

describe('brandSchema', () => {
  const validBrand = {
    id: UUID,
    name: 'Acme Corp',
    goals: null,
    successDefinition: null,
    customFields: {},
    syncConfig: null,
    featureRequestsConfig: null,
    status: 'active' as const,
    importError: null,
    importedFrom: null,
    rawImportContent: null,
    createdAt: DT,
    updatedAt: DT,
  };

  it('accepts a valid brand', () => {
    expect(brandSchema.parse(validBrand)).toEqual(validBrand);
  });

  it('brandStatusSchema accepts valid values', () => {
    expect(brandStatusSchema.parse('active')).toBe('active');
    expect(brandStatusSchema.parse('importing')).toBe('importing');
    expect(brandStatusSchema.parse('import_failed')).toBe('import_failed');
  });

  it('brandStatusSchema rejects invalid', () => {
    expect(() => brandStatusSchema.parse('deleted')).toThrow();
  });

  it('defaults customFields to {} when omitted', () => {
    const { customFields: _, ...withoutCustomFields } = validBrand;
    const result = brandSchema.parse(withoutCustomFields);
    expect(result.customFields).toEqual({});
  });
});

/* ─────────────── brand meeting ─────────────── */

describe('brandMeetingSchema', () => {
  const validMeeting = {
    id: UUID,
    brandId: UUID,
    date: '2026-04-15',
    title: 'Weekly sync',
    attendees: ['Alice', 'Bob'],
    attendeeUserIds: [],
    summary: null,
    rawNotes: 'Notes from the meeting',
    decisions: ['Ship v2'],
    source: 'manual',
    externalMeetingId: null,
    recordingUrl: null,
    createdAt: DT,
  };

  it('accepts a valid meeting', () => {
    expect(brandMeetingSchema.parse(validMeeting)).toEqual(validMeeting);
  });

  it('accepts a meeting with attendeeUserIds populated', () => {
    const withUserIds = { ...validMeeting, attendeeUserIds: [UUID] };
    expect(brandMeetingSchema.parse(withUserIds).attendeeUserIds).toEqual([UUID]);
  });

  it('rejects non-uuid in attendeeUserIds', () => {
    expect(() =>
      brandMeetingSchema.parse({ ...validMeeting, attendeeUserIds: ['not-uuid'] }),
    ).toThrow();
  });

  it('attendees is an array of strings', () => {
    expect(() =>
      brandMeetingSchema.parse({ ...validMeeting, attendees: 'not-array' }),
    ).toThrow();
  });

  it('rawNotes is required', () => {
    const { rawNotes: _, ...withoutNotes } = validMeeting;
    expect(() => brandMeetingSchema.parse(withoutNotes)).toThrow();
  });

  it('createBrandMeetingInputSchema defaults attendees and decisions', () => {
    const result = createBrandMeetingInputSchema.parse({
      date: '2026-04-15',
      title: 'Standup',
      rawNotes: 'Notes',
    });
    expect(result.attendees).toEqual([]);
    expect(result.decisions).toEqual([]);
  });
});

/* ─────────────── brand action item ─────────────── */

describe('brandActionItemSchema + create/update', () => {
  const validItem = {
    id: UUID,
    brandId: UUID,
    meetingId: null,
    creatorId: UUID,
    assigneeId: null,
    text: 'Follow up with client',
    status: 'open' as const,
    owner: null,
    dueDate: null,
    linkedTaskId: null,
    meetingDate: null,
    createdAt: DT,
    completedAt: null,
  };

  it('accepts a valid action item with null assignee', () => {
    expect(brandActionItemSchema.parse(validItem)).toEqual(validItem);
  });

  it('accepts a valid action item with assignee set', () => {
    const assigned = { ...validItem, assigneeId: UUID };
    expect(brandActionItemSchema.parse(assigned).assigneeId).toBe(UUID);
  });

  it('requires creatorId', () => {
    const { creatorId: _, ...withoutCreator } = validItem;
    expect(() => brandActionItemSchema.parse(withoutCreator)).toThrow();
  });

  it('brandActionStatusSchema accepts open and done', () => {
    expect(brandActionStatusSchema.parse('open')).toBe('open');
    expect(brandActionStatusSchema.parse('done')).toBe('done');
  });

  it('brandActionStatusSchema rejects invalid', () => {
    expect(() => brandActionStatusSchema.parse('closed')).toThrow();
  });

  it('createBrandActionItemInputSchema requires text', () => {
    expect(() => createBrandActionItemInputSchema.parse({})).toThrow();
  });

  it('createBrandActionItemInputSchema accepts text only', () => {
    const result = createBrandActionItemInputSchema.parse({ text: 'Do thing' });
    expect(result.text).toBe('Do thing');
  });

  it('createBrandActionItemInputSchema accepts assigneeId', () => {
    const result = createBrandActionItemInputSchema.parse({ text: 'x', assigneeId: UUID });
    expect(result.assigneeId).toBe(UUID);
  });

  it('createBrandActionItemInputSchema accepts null assigneeId', () => {
    const result = createBrandActionItemInputSchema.parse({ text: 'x', assigneeId: null });
    expect(result.assigneeId).toBeNull();
  });

  it('updateBrandActionItemInputSchema accepts status extension', () => {
    const result = updateBrandActionItemInputSchema.parse({ status: 'done' });
    expect(result.status).toBe('done');
  });

  it('updateBrandActionItemInputSchema rejects unknown keys (strict)', () => {
    expect(() => updateBrandActionItemInputSchema.parse({ unknownField: true })).toThrow();
  });
});

describe('sendActionItemToTodayInputSchema', () => {
  it('requires assigneeId', () => {
    expect(() => sendActionItemToTodayInputSchema.parse({})).toThrow();
  });

  it('rejects non-uuid assigneeId', () => {
    expect(() => sendActionItemToTodayInputSchema.parse({ assigneeId: 'x' })).toThrow();
  });

  it('rejects extra keys (strict)', () => {
    expect(() =>
      sendActionItemToTodayInputSchema.parse({ assigneeId: UUID, extra: true }),
    ).toThrow();
  });

  it('accepts a valid uuid', () => {
    expect(sendActionItemToTodayInputSchema.parse({ assigneeId: UUID })).toEqual({
      assigneeId: UUID,
    });
  });
});

/* ─────────────── export / import ─────────────── */

describe('exportFileSchema', () => {
  const minimalSettings = {
    dailyCapacityMinutes: 480,
    theme: 'dark' as const,
    userName: 'Nader',
    lastExportDate: null,
    onboarded: true,
  };

  const validExport = {
    version: '1.2' as const,
    exportedAt: DT,
    settings: minimalSettings,
    roles: [],
    tasks: [],
    dailyLogs: [],
    parkings: [],
    brands: [],
    brandStakeholders: [],
    brandMeetings: [],
    brandActionItems: [],
  };

  it('accepts a valid v1.2 export', () => {
    const result = exportFileSchema.parse(validExport);
    expect(result.version).toBe('1.2');
  });

  it('defaults parkings to [] when missing (v1.0 compat)', () => {
    const v10 = {
      version: '1.0' as const,
      exportedAt: DT,
      settings: minimalSettings,
      roles: [],
      tasks: [],
      dailyLogs: [],
    };
    const result = exportFileSchema.parse(v10);
    expect(result.parkings).toEqual([]);
  });

  it('defaults brands to [] when missing (v1.1 compat)', () => {
    const v11 = {
      version: '1.1' as const,
      exportedAt: DT,
      settings: minimalSettings,
      roles: [],
      tasks: [],
      dailyLogs: [],
      parkings: [],
    };
    const result = exportFileSchema.parse(v11);
    expect(result.brands).toEqual([]);
    expect(result.brandStakeholders).toEqual([]);
    expect(result.brandMeetings).toEqual([]);
    expect(result.brandActionItems).toEqual([]);
  });

  it('accepts v1.3 and defaults brandFeatureRequests to []', () => {
    const v13 = {
      ...validExport,
      version: '1.3' as const,
    };
    const result = exportFileSchema.parse(v13);
    expect(result.version).toBe('1.3');
    expect(result.brandFeatureRequests).toEqual([]);
  });

  it('defaults brandFeatureRequests to [] when missing (v1.2 compat)', () => {
    const result = exportFileSchema.parse(validExport);
    expect(result.brandFeatureRequests).toEqual([]);
  });

  it('accepts v1.4 and defaults new team collections to []', () => {
    const v14 = { ...validExport, version: '1.4' as const };
    const result = exportFileSchema.parse(v14);
    expect(result.version).toBe('1.4');
    expect(result.users).toEqual([]);
    expect(result.brandEvents).toEqual([]);
    expect(result.inboxEvents).toEqual([]);
  });

  it('v1.4 accepts a populated users collection', () => {
    const v14 = {
      ...validExport,
      version: '1.4' as const,
      users: [
        {
          id: UUID,
          email: 'nader@omnirev.ai',
          displayName: 'Nader',
          avatarColor: '#0FB848',
          deactivatedAt: null,
        },
      ],
    };
    const result = exportFileSchema.parse(v14);
    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.displayName).toBe('Nader');
  });

  it('v1.3 file without creator/assignee on tasks is accepted (backward compat)', () => {
    const v13 = {
      ...validExport,
      version: '1.3' as const,
      tasks: [
        {
          id: 'task-legacy-1',
          title: 'Old task',
          roleId: null,
          priority: 'medium',
          estimateMinutes: null,
          actualMinutes: null,
          status: 'todo',
          column: 'up_next',
          scheduledDate: null,
          createdAt: DT,
          startedAt: null,
          completedAt: null,
        },
      ],
    };
    const result = exportFileSchema.parse(v13);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.creatorId).toBeUndefined();
    expect(result.tasks[0]?.assigneeId).toBeUndefined();
  });

  it('v1.3 file without creator/visibility/involved on parkings is accepted', () => {
    const v13 = {
      ...validExport,
      version: '1.3' as const,
      parkings: [
        {
          id: 'p-1',
          title: 'Legacy parking',
          notes: null,
          outcome: null,
          targetDate: null,
          roleId: null,
          priority: 'medium',
          status: 'open',
          createdAt: DT,
          discussedAt: null,
        },
      ],
    };
    const result = exportFileSchema.parse(v13);
    expect(result.parkings[0]?.creatorId).toBeUndefined();
    expect(result.parkings[0]?.visibility).toBeUndefined();
    expect(result.parkings[0]?.involvedIds).toBeUndefined();
  });

  it('v1.4 file with populated creator/assignee on tasks round-trips', () => {
    const v14 = {
      ...validExport,
      version: '1.4' as const,
      tasks: [
        {
          id: 'task-new-1',
          creatorId: UUID,
          assigneeId: UUID,
          title: 'New task',
          roleId: null,
          priority: 'medium',
          estimateMinutes: null,
          actualMinutes: null,
          status: 'todo',
          column: 'up_next',
          scheduledDate: null,
          createdAt: DT,
          startedAt: null,
          completedAt: null,
        },
      ],
    };
    const result = exportFileSchema.parse(v14);
    expect(result.tasks[0]?.creatorId).toBe(UUID);
    expect(result.tasks[0]?.assigneeId).toBe(UUID);
  });

  it('rejects invalid version', () => {
    expect(() => exportFileSchema.parse({ ...validExport, version: '2.0' })).toThrow();
  });
});

describe('importRequestSchema', () => {
  it('importModeSchema accepts replace and merge', () => {
    expect(importModeSchema.parse('replace')).toBe('replace');
    expect(importModeSchema.parse('merge')).toBe('merge');
  });

  it('importModeSchema rejects invalid', () => {
    expect(() => importModeSchema.parse('append')).toThrow();
  });

  it('accepts a valid import request', () => {
    const validExport = {
      version: '1.2' as const,
      exportedAt: DT,
      settings: {
        dailyCapacityMinutes: 480,
        theme: 'dark' as const,
        userName: 'Nader',
        lastExportDate: null,
        onboarded: true,
      },
      roles: [],
      tasks: [],
      dailyLogs: [],
    };
    const result = importRequestSchema.parse({ mode: 'replace', file: validExport });
    expect(result.mode).toBe('replace');
    expect(result.file.version).toBe('1.2');
  });
});

/* ─────────────── auth ─────────────── */

describe('auth schemas', () => {
  it('registerInputSchema accepts valid input', () => {
    const result = registerInputSchema.parse({
      email: 'test@example.com',
      password: 'securepassword',
      userName: 'Nader',
    });
    expect(result.email).toBe('test@example.com');
  });

  it('registerInputSchema rejects invalid email', () => {
    expect(() =>
      registerInputSchema.parse({ email: 'not-an-email', password: '12345678', userName: 'X' }),
    ).toThrow();
  });

  it('registerInputSchema rejects password shorter than 8', () => {
    expect(() =>
      registerInputSchema.parse({ email: 'a@b.com', password: 'short', userName: 'X' }),
    ).toThrow();
  });

  it('loginInputSchema accepts valid input', () => {
    const result = loginInputSchema.parse({ email: 'a@b.com', password: 'x' });
    expect(result.email).toBe('a@b.com');
  });

  it('loginInputSchema allows password min 1', () => {
    expect(loginInputSchema.parse({ email: 'a@b.com', password: 'a' }).password).toBe('a');
  });

  it('loginInputSchema rejects empty password', () => {
    expect(() => loginInputSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });
});

/* ─────────────── team-space: identity + events + stats ─────────────── */

describe('authUserSchema', () => {
  const valid = {
    id: UUID,
    email: 'nader@omnirev.ai',
    displayName: 'Nader Samadyan',
    avatarColor: '#0FB848',
  };

  it('accepts a valid auth user with team-space fields', () => {
    expect(authUserSchema.parse(valid)).toEqual(valid);
  });

  it('requires displayName', () => {
    const { displayName: _, ...without } = valid;
    expect(() => authUserSchema.parse(without)).toThrow();
  });

  it('requires avatarColor as hex', () => {
    expect(() => authUserSchema.parse({ ...valid, avatarColor: 'red' })).toThrow();
  });

  it('accepts empty displayName (pre-wizard state)', () => {
    expect(authUserSchema.parse({ ...valid, displayName: '' }).displayName).toBe('');
  });
});

describe('userSummarySchema', () => {
  const valid = {
    id: UUID,
    email: 'sara@omnirev.ai',
    displayName: 'Sara Pourmir',
    avatarColor: '#F7B24F',
    deactivatedAt: null,
  };

  it('accepts a valid active user', () => {
    expect(userSummarySchema.parse(valid)).toEqual(valid);
  });

  it('accepts a deactivated user with timestamp', () => {
    const deactivated = { ...valid, deactivatedAt: DT };
    expect(userSummarySchema.parse(deactivated).deactivatedAt).toBe(DT);
  });

  it('requires deactivatedAt to be datetime or null', () => {
    expect(() => userSummarySchema.parse({ ...valid, deactivatedAt: 'yesterday' })).toThrow();
  });
});

describe('updateMeInputSchema', () => {
  it('accepts displayName', () => {
    const r = updateMeInputSchema.parse({ displayName: 'Ryan' });
    expect(r.displayName).toBe('Ryan');
  });

  it('rejects empty displayName', () => {
    expect(() => updateMeInputSchema.parse({ displayName: '' })).toThrow();
  });

  it('rejects extra keys (strict)', () => {
    expect(() => updateMeInputSchema.parse({ displayName: 'x', extra: true })).toThrow();
  });
});

describe('inboxEventSchema', () => {
  const actor = {
    id: UUID,
    email: 'sara@omnirev.ai',
    displayName: 'Sara',
    avatarColor: '#F7B24F',
    deactivatedAt: null,
  };

  const validEvent = {
    id: UUID,
    userId: UUID,
    actor,
    eventType: 'task_assigned' as const,
    entityType: 'task',
    entityId: UUID,
    payload: { previousAssigneeId: null },
    entity: { id: UUID, title: 'Review Boudin proposal' },
    readAt: null,
    createdAt: DT,
  };

  it('accepts a valid task_assigned event', () => {
    expect(inboxEventSchema.parse(validEvent).eventType).toBe('task_assigned');
  });

  it('accepts all five event types', () => {
    for (const t of [
      'task_assigned',
      'task_edited',
      'action_item_assigned',
      'action_item_edited',
      'parking_involvement',
    ] as const) {
      expect(inboxEventSchema.parse({ ...validEvent, eventType: t }).eventType).toBe(t);
    }
  });

  it('rejects unknown eventType', () => {
    expect(() =>
      inboxEventSchema.parse({ ...validEvent, eventType: 'made_up_type' }),
    ).toThrow();
  });

  it('accepts null entity (entity was deleted after event)', () => {
    expect(inboxEventSchema.parse({ ...validEvent, entity: null }).entity).toBeNull();
  });

  it('accepts a read timestamp', () => {
    expect(inboxEventSchema.parse({ ...validEvent, readAt: DT }).readAt).toBe(DT);
  });
});

describe('brandEventSchema', () => {
  const actor = {
    id: UUID,
    email: 'nader@omnirev.ai',
    displayName: 'Nader',
    avatarColor: '#0FB848',
    deactivatedAt: null,
  };

  const validEvent = {
    id: UUID,
    brandId: UUID,
    actor,
    eventType: 'action_item_completed' as const,
    entityType: 'brand_action_item',
    entityId: UUID,
    payload: {},
    createdAt: DT,
  };

  it('accepts a valid brand event', () => {
    expect(brandEventSchema.parse(validEvent).eventType).toBe('action_item_completed');
  });

  it('allows null entityId (e.g., brand-level events)', () => {
    expect(brandEventSchema.parse({ ...validEvent, entityId: null }).entityId).toBeNull();
  });

  it('rejects unknown eventType', () => {
    expect(() =>
      brandEventSchema.parse({ ...validEvent, eventType: 'unknown' }),
    ).toThrow();
  });
});

describe('teamTaskListSchema', () => {
  const UUID2 = 'b2ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
  const user = {
    id: UUID,
    email: 'nader@omnirev.ai',
    displayName: 'Nader',
    avatarColor: '#0FB848',
    deactivatedAt: null,
  };

  it('accepts empty sections', () => {
    expect(teamTaskListSchema.parse({ sections: [] })).toEqual({ sections: [] });
  });

  it('accepts a section with a user and tasks', () => {
    const result = teamTaskListSchema.parse({
      sections: [
        {
          user,
          tasks: [
            {
              id: UUID,
              creatorId: UUID,
              assigneeId: UUID2,
              title: 'T',
              description: null,
              roleId: null,
              priority: 'medium',
              estimateMinutes: null,
              actualMinutes: null,
              status: 'todo',
              column: 'up_next',
              scheduledDate: null,
              createdAt: DT,
              startedAt: null,
              completedAt: null,
            },
          ],
        },
      ],
    });
    expect(result.sections[0]?.tasks).toHaveLength(1);
  });
});

describe('teamWeeklyStatsSchema', () => {
  const user = {
    id: UUID,
    email: 'nader@omnirev.ai',
    displayName: 'Nader',
    avatarColor: '#0FB848',
    deactivatedAt: null,
  };

  it('accepts per-user stats', () => {
    const result = teamWeeklyStatsSchema.parse({
      users: [
        {
          user,
          completionRate: 0.8,
          estimationAccuracy: null,
          streak: 3,
          mostActiveRoleId: null,
        },
      ],
    });
    expect(result.users[0]?.streak).toBe(3);
  });

  it('rejects completionRate > 1', () => {
    expect(() =>
      teamWeeklyStatsSchema.parse({
        users: [
          {
            user,
            completionRate: 1.5,
            estimationAccuracy: null,
            streak: 0,
            mostActiveRoleId: null,
          },
        ],
      }),
    ).toThrow();
  });
});

describe('teamTodayStatsSchema', () => {
  it('accepts valid team-today stats', () => {
    const result = teamTodayStatsSchema.parse({
      teamCompletionRate: 0.82,
      usersWithInProgressCount: 2,
    });
    expect(result.teamCompletionRate).toBe(0.82);
    expect(result.usersWithInProgressCount).toBe(2);
  });

  it('rejects negative in-progress count', () => {
    expect(() =>
      teamTodayStatsSchema.parse({ teamCompletionRate: 0.5, usersWithInProgressCount: -1 }),
    ).toThrow();
  });
});

/* ─────────────── ROLE_COLOR_PALETTE ─────────────── */

describe('ROLE_COLOR_PALETTE', () => {
  it('has exactly 8 colors', () => {
    expect(ROLE_COLOR_PALETTE).toHaveLength(8);
  });

  it('all colors match hex format', () => {
    for (const color of ROLE_COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
