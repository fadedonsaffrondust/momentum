import { describe, it, expect } from 'vitest';
import {
  mapTask,
  mapRole,
  mapSettings,
  mapDailyLog,
  mapParking,
  mapBrand,
  mapBrandStakeholder,
  mapBrandMeeting,
  mapBrandActionItem,
} from './mappers.js';

const NOW = new Date('2026-04-15T10:30:00.000Z');
const EARLIER = new Date('2026-04-14T08:00:00.000Z');
const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID2 = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';

// ---------- mapTask ----------

describe('mapTask', () => {
  it('converts Date fields to ISO strings and passes through scalars', () => {
    const row = {
      id: UUID,
      userId: UUID2,
      title: 'Ship feature',
      roleId: UUID,
      priority: 2,
      estimateMinutes: 30,
      actualMinutes: 25,
      status: 'in_progress' as const,
      column: 'in_progress' as const,
      scheduledDate: '2026-04-15',
      createdAt: NOW,
      startedAt: EARLIER,
      completedAt: NOW,
    };

    const result = mapTask(row as any);

    expect(result.id).toBe(UUID);
    expect(result.userId).toBe(UUID2);
    expect(result.title).toBe('Ship feature');
    expect(result.roleId).toBe(UUID);
    expect(result.priority).toBe(2);
    expect(result.estimateMinutes).toBe(30);
    expect(result.actualMinutes).toBe(25);
    expect(result.status).toBe('in_progress');
    expect(result.column).toBe('in_progress');
    expect(result.scheduledDate).toBe('2026-04-15');
    expect(result.createdAt).toBe('2026-04-15T10:30:00.000Z');
    expect(result.startedAt).toBe('2026-04-14T08:00:00.000Z');
    expect(result.completedAt).toBe('2026-04-15T10:30:00.000Z');
  });

  it('maps null dates to null', () => {
    const row = {
      id: UUID,
      userId: UUID2,
      title: 'Todo',
      roleId: null,
      priority: 0,
      estimateMinutes: null,
      actualMinutes: null,
      status: 'todo' as const,
      column: 'up_next' as const,
      scheduledDate: null,
      createdAt: NOW,
      startedAt: null,
      completedAt: null,
    };

    const result = mapTask(row as any);

    expect(result.startedAt).toBeNull();
    expect(result.completedAt).toBeNull();
  });
});

// ---------- mapRole ----------

describe('mapRole', () => {
  it('passes through all fields', () => {
    const row = { id: UUID, name: 'Engineering', color: '#3b82f6', position: 1 };
    const result = mapRole(row as any);

    expect(result).toEqual({
      id: UUID,
      name: 'Engineering',
      color: '#3b82f6',
      position: 1,
    });
  });
});

// ---------- mapSettings ----------

describe('mapSettings', () => {
  it('converts lastExportDate to ISO string', () => {
    const row = {
      userId: UUID,
      dailyCapacityMinutes: 480,
      theme: 'dark',
      userName: 'Nader',
      lastExportDate: NOW,
      onboarded: true,
    };

    const result = mapSettings(row as any);

    expect(result.userId).toBe(UUID);
    expect(result.dailyCapacityMinutes).toBe(480);
    expect(result.theme).toBe('dark');
    expect(result.userName).toBe('Nader');
    expect(result.lastExportDate).toBe('2026-04-15T10:30:00.000Z');
    expect(result.onboarded).toBe(true);
  });

  it('maps null lastExportDate to null', () => {
    const row = {
      userId: UUID,
      dailyCapacityMinutes: 480,
      theme: 'light',
      userName: 'Test',
      lastExportDate: null,
      onboarded: false,
    };

    const result = mapSettings(row as any);
    expect(result.lastExportDate).toBeNull();
  });
});

// ---------- mapDailyLog ----------

describe('mapDailyLog', () => {
  it('passes through all fields unchanged', () => {
    const row = {
      id: UUID,
      userId: UUID2,
      date: '2026-04-15',
      tasksPlanned: 5,
      tasksCompleted: 3,
      totalEstimatedMinutes: 120,
      totalActualMinutes: 100,
      journalEntry: 'Good day',
      completionRate: 60,
    };

    const result = mapDailyLog(row as any);

    expect(result).toEqual(row);
  });
});

// ---------- mapParking ----------

describe('mapParking', () => {
  it('converts Date fields to ISO strings', () => {
    const row = {
      id: UUID,
      userId: UUID2,
      title: 'Discuss pricing',
      notes: 'Review competitors',
      outcome: null,
      targetDate: '2026-04-20',
      roleId: UUID,
      priority: 1,
      status: 'open' as const,
      createdAt: NOW,
      discussedAt: EARLIER,
    };

    const result = mapParking(row as any);

    expect(result.id).toBe(UUID);
    expect(result.title).toBe('Discuss pricing');
    expect(result.createdAt).toBe('2026-04-15T10:30:00.000Z');
    expect(result.discussedAt).toBe('2026-04-14T08:00:00.000Z');
  });

  it('maps null discussedAt to null', () => {
    const row = {
      id: UUID,
      userId: UUID2,
      title: 'Open topic',
      notes: null,
      outcome: null,
      targetDate: null,
      roleId: null,
      priority: 0,
      status: 'open' as const,
      createdAt: NOW,
      discussedAt: null,
    };

    const result = mapParking(row as any);
    expect(result.discussedAt).toBeNull();
  });
});

// ---------- mapBrand ----------

describe('mapBrand', () => {
  it('converts Date fields and defaults customFields null to {}', () => {
    const row = {
      id: UUID,
      userId: UUID2,
      name: 'Acme Corp',
      goals: 'Increase retention',
      successDefinition: 'Churn below 5%',
      customFields: null,
      syncConfig: null,
      status: 'active' as const,
      importError: null,
      importedFrom: null,
      rawImportContent: null,
      createdAt: NOW,
      updatedAt: NOW,
    };

    const result = mapBrand(row as any);

    expect(result.id).toBe(UUID);
    expect(result.name).toBe('Acme Corp');
    expect(result.customFields).toEqual({});
    expect(result.syncConfig).toBeNull();
    expect(result.createdAt).toBe('2026-04-15T10:30:00.000Z');
    expect(result.updatedAt).toBe('2026-04-15T10:30:00.000Z');
  });

  it('preserves populated customFields', () => {
    const fields = { vertical: 'SaaS', tier: 'enterprise' };
    const row = {
      id: UUID,
      userId: UUID2,
      name: 'Brand',
      goals: null,
      successDefinition: null,
      customFields: fields,
      syncConfig: { matchRules: {}, syncedMeetingIds: [] },
      status: 'active' as const,
      importError: null,
      importedFrom: null,
      rawImportContent: null,
      createdAt: NOW,
      updatedAt: NOW,
    };

    const result = mapBrand(row as any);
    expect(result.customFields).toEqual(fields);
  });
});

// ---------- mapBrandStakeholder ----------

describe('mapBrandStakeholder', () => {
  it('converts createdAt to ISO string', () => {
    const row = {
      id: UUID,
      brandId: UUID2,
      userId: UUID,
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'VP Marketing',
      notes: 'Key decision maker',
      createdAt: NOW,
    };

    const result = mapBrandStakeholder(row as any);

    expect(result.id).toBe(UUID);
    expect(result.name).toBe('Jane Doe');
    expect(result.email).toBe('jane@example.com');
    expect(result.role).toBe('VP Marketing');
    expect(result.createdAt).toBe('2026-04-15T10:30:00.000Z');
  });
});

// ---------- mapBrandMeeting ----------

describe('mapBrandMeeting', () => {
  it('converts createdAt and defaults null arrays to []', () => {
    const row = {
      id: UUID,
      brandId: UUID2,
      userId: UUID,
      date: '2026-04-15',
      title: 'Kickoff',
      attendees: null,
      summary: 'Went well',
      rawNotes: 'Raw text',
      decisions: null,
      source: 'manual',
      externalMeetingId: null,
      recordingUrl: null,
      createdAt: NOW,
    };

    const result = mapBrandMeeting(row as any);

    expect(result.attendees).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.source).toBe('manual');
    expect(result.externalMeetingId).toBeNull();
    expect(result.recordingUrl).toBeNull();
    expect(result.createdAt).toBe('2026-04-15T10:30:00.000Z');
    expect(result.title).toBe('Kickoff');
  });

  it('preserves populated attendees and decisions', () => {
    const row = {
      id: UUID,
      brandId: UUID2,
      userId: UUID,
      date: '2026-04-15',
      title: 'Review',
      attendees: ['Alice', 'Bob'],
      summary: null,
      rawNotes: null,
      decisions: ['Ship it'],
      source: 'recording_sync',
      externalMeetingId: 'tldv-123',
      recordingUrl: 'https://tldv.io/play/123',
      createdAt: NOW,
    };

    const result = mapBrandMeeting(row as any);

    expect(result.attendees).toEqual(['Alice', 'Bob']);
    expect(result.decisions).toEqual(['Ship it']);
    expect(result.source).toBe('recording_sync');
    expect(result.externalMeetingId).toBe('tldv-123');
    expect(result.recordingUrl).toBe('https://tldv.io/play/123');
  });
});

// ---------- mapBrandActionItem ----------

describe('mapBrandActionItem', () => {
  it('converts Date fields to ISO strings', () => {
    const row = {
      id: UUID,
      brandId: UUID2,
      meetingId: UUID,
      userId: UUID2,
      text: 'Follow up on proposal',
      status: 'open' as const,
      owner: 'Nader',
      dueDate: '2026-04-20',
      linkedTaskId: UUID,
      meetingDate: '2026-04-15',
      createdAt: NOW,
      completedAt: EARLIER,
    };

    const result = mapBrandActionItem(row as any);

    expect(result.id).toBe(UUID);
    expect(result.text).toBe('Follow up on proposal');
    expect(result.meetingDate).toBe('2026-04-15');
    expect(result.createdAt).toBe('2026-04-15T10:30:00.000Z');
    expect(result.completedAt).toBe('2026-04-14T08:00:00.000Z');
  });

  it('maps null completedAt and missing meetingDate to null', () => {
    const row = {
      id: UUID,
      brandId: UUID2,
      meetingId: null,
      userId: UUID2,
      text: 'Open action',
      status: 'open' as const,
      owner: null,
      dueDate: null,
      linkedTaskId: null,
      createdAt: NOW,
      completedAt: null,
    };

    const result = mapBrandActionItem(row as any);
    expect(result.completedAt).toBeNull();
    expect(result.meetingDate).toBeNull();
  });
});
