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
  exportFileSchema,
  importModeSchema,
  importRequestSchema,
  registerInputSchema,
  loginInputSchema,
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
  const validTask = {
    id: UUID,
    userId: UUID,
    title: 'Ship feature',
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

  it('accepts a full valid task', () => {
    expect(taskSchema.parse(validTask)).toEqual(validTask);
  });

  it('allows null scheduledDate, roleId, estimateMinutes, actualMinutes', () => {
    const result = taskSchema.parse(validTask);
    expect(result.scheduledDate).toBeNull();
    expect(result.roleId).toBeNull();
    expect(result.estimateMinutes).toBeNull();
    expect(result.actualMinutes).toBeNull();
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

  it('accepts all optional fields', () => {
    const input = {
      title: 'Do thing',
      roleId: UUID,
      priority: 'high' as const,
      estimateMinutes: 30,
      scheduledDate: '2026-04-15',
    };
    expect(createTaskInputSchema.parse(input)).toEqual(input);
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
    userId: UUID,
    title: 'Discuss pricing',
    notes: null,
    outcome: null,
    targetDate: null,
    roleId: null,
    priority: 'medium' as const,
    status: 'open' as const,
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

  it('accepts a valid parking', () => {
    expect(parkingSchema.parse(validParking)).toEqual(validParking);
  });

  it('createParkingInputSchema requires title', () => {
    expect(() => createParkingInputSchema.parse({})).toThrow();
  });

  it('createParkingInputSchema accepts title only', () => {
    const result = createParkingInputSchema.parse({ title: 'Topic' });
    expect(result.title).toBe('Topic');
  });

  it('createParkingInputSchema accepts all optional fields', () => {
    const input = {
      title: 'Topic',
      notes: 'some notes',
      outcome: null,
      targetDate: '2026-05-01',
      roleId: UUID,
      priority: 'high' as const,
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

  it('updateParkingInputSchema rejects unknown keys (strict)', () => {
    expect(() => updateParkingInputSchema.parse({ unknownField: true })).toThrow();
  });
});

/* ─────────────── brand ─────────────── */

describe('brandSchema', () => {
  const validBrand = {
    id: UUID,
    userId: UUID,
    name: 'Acme Corp',
    goals: null,
    successDefinition: null,
    customFields: {},
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
    userId: UUID,
    date: '2026-04-15',
    title: 'Weekly sync',
    attendees: ['Alice', 'Bob'],
    summary: null,
    rawNotes: 'Notes from the meeting',
    decisions: ['Ship v2'],
    createdAt: DT,
  };

  it('accepts a valid meeting', () => {
    expect(brandMeetingSchema.parse(validMeeting)).toEqual(validMeeting);
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
    userId: UUID,
    text: 'Follow up with client',
    status: 'open' as const,
    owner: null,
    dueDate: null,
    linkedTaskId: null,
    createdAt: DT,
    completedAt: null,
  };

  it('accepts a valid action item', () => {
    expect(brandActionItemSchema.parse(validItem)).toEqual(validItem);
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

  it('updateBrandActionItemInputSchema accepts status extension', () => {
    const result = updateBrandActionItemInputSchema.parse({ status: 'done' });
    expect(result.status).toBe('done');
  });

  it('updateBrandActionItemInputSchema rejects unknown keys (strict)', () => {
    expect(() => updateBrandActionItemInputSchema.parse({ unknownField: true })).toThrow();
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
