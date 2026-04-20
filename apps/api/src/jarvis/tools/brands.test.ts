import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import type { ToolContext, JarvisLogger } from './types.ts';
import { getBrand, getBrands, getBrandActionItems, getBrandMeetings } from './brands.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const BRAND_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOW = new Date('2026-04-19T12:00:00.000Z');

function makeLogger(): JarvisLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeCtx(db: unknown): ToolContext {
  return {
    userId: USER_ID,
    now: NOW,
    db: db as unknown as Database,
    logger: makeLogger(),
  };
}

describe('getBrand', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getBrand.name).toBe('getBrand');
    expect(getBrand.readOnly).toBe(true);
    expect(getBrand.description).toMatch(/specific brand/i);
  });

  it('assembles brand + stakeholders + recent meetings + action item counts', async () => {
    const mockDb = createMockDb();
    // 1) brand lookup
    mockDb._pushResult([
      {
        id: BRAND_ID,
        name: 'Boudin',
        goals: 'Grow catering 20% QoQ',
        successDefinition: 'Weekly ops check-in + 90%+ platform adoption',
        customFields: { tier: 'enterprise' },
        syncConfig: null,
        status: 'active',
        importError: null,
        importedFrom: null,
        rawImportContent: null,
        featureRequestsConfig: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T09:00:00.000Z'),
      },
    ]);
    // Then the three parallel queries — order matches the Promise.all order
    // in the handler: stakeholders, meetings, action-item counts.
    mockDb._pushResult([
      {
        id: 'sh-1',
        name: 'Ava Operator',
        email: 'ava@boudin.test',
        role: 'Catering Manager',
      },
    ]);
    mockDb._pushResult([
      {
        id: 'mt-1',
        title: 'Weekly ops',
        date: '2026-04-18',
        source: 'manual',
        summary: null,
      },
    ]);
    mockDb._pushResult([
      { status: 'open', count: 3 },
      { status: 'done', count: 12 },
    ]);
    const ctx = makeCtx(mockDb);

    const result = await getBrand.handler({ brandId: BRAND_ID }, ctx);

    expect(result).not.toBeNull();
    const brand = result!;
    expect(brand.id).toBe(BRAND_ID);
    expect(brand.name).toBe('Boudin');
    expect(brand.status).toBe('active');
    expect(brand.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(brand.updatedAt).toBe('2026-04-15T09:00:00.000Z');
    expect(brand.stakeholders).toEqual([
      { id: 'sh-1', name: 'Ava Operator', email: 'ava@boudin.test', role: 'Catering Manager' },
    ]);
    expect(brand.recentMeetings).toEqual([
      { id: 'mt-1', title: 'Weekly ops', date: '2026-04-18', source: 'manual', summary: null },
    ]);
    expect(brand.actionItemCounts).toEqual({ open: 3, done: 12 });
    expect(brand.customFields).toEqual({ tier: 'enterprise' });
  });

  it('returns null when the brand is not found', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]); // empty brand lookup
    const ctx = makeCtx(mockDb);

    const result = await getBrand.handler({ brandId: BRAND_ID }, ctx);
    expect(result).toBeNull();
  });

  it('handles a brand with no stakeholders / meetings / action items', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: BRAND_ID,
        name: 'Fresh Brand',
        goals: null,
        successDefinition: null,
        customFields: {},
        syncConfig: null,
        status: 'active',
        importError: null,
        importedFrom: null,
        rawImportContent: null,
        featureRequestsConfig: null,
        createdAt: new Date('2026-04-19T00:00:00.000Z'),
        updatedAt: new Date('2026-04-19T00:00:00.000Z'),
      },
    ]);
    mockDb._pushResult([]); // stakeholders
    mockDb._pushResult([]); // meetings
    mockDb._pushResult([]); // action item counts
    const ctx = makeCtx(mockDb);

    const result = await getBrand.handler({ brandId: BRAND_ID }, ctx);
    expect(result).not.toBeNull();
    expect(result!.stakeholders).toEqual([]);
    expect(result!.recentMeetings).toEqual([]);
    expect(result!.actionItemCounts).toEqual({ open: 0, done: 0 });
  });

  it('validates brandId is a UUID', () => {
    expect(() => getBrand.inputSchema.parse({ brandId: 'not-a-uuid' })).toThrow();
    expect(() => getBrand.inputSchema.parse({ brandId: BRAND_ID })).not.toThrow();
  });
});

describe('getBrands', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getBrands.name).toBe('getBrands');
    expect(getBrands.readOnly).toBe(true);
    expect(getBrands.description).toMatch(/list of brands/i);
  });

  it('joins last-activity + open-count onto each brand', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: BRAND_ID,
        name: 'Boudin',
        status: 'active',
        goals: null,
        successDefinition: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T09:00:00.000Z'),
      },
    ]);
    mockDb._pushResult([
      { brandId: BRAND_ID, lastCreatedAt: new Date('2026-04-18T09:00:00.000Z') },
    ]);
    mockDb._pushResult([{ brandId: BRAND_ID, openCount: 3 }]);
    const ctx = makeCtx(mockDb);
    const result = await getBrands.handler({ limit: 50 }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: BRAND_ID,
      name: 'Boudin',
      lastActivityAt: '2026-04-18T09:00:00.000Z',
      openActionItemCount: 3,
    });
  });

  it('returns [] with no extra queries when the brand list is empty', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    const ctx = makeCtx(mockDb);
    const result = await getBrands.handler({ limit: 50 }, ctx);
    expect(result).toEqual([]);
  });
});

describe('getBrandActionItems', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getBrandActionItems.name).toBe('getBrandActionItems');
    expect(getBrandActionItems.readOnly).toBe(true);
    expect(getBrandActionItems.description).toMatch(/action items/i);
  });

  it('returns action items with ISO timestamps', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: 'ai-1',
        brandId: BRAND_ID,
        meetingId: null,
        creatorId: USER_ID,
        assigneeId: USER_ID,
        text: 'Send the deck',
        status: 'open',
        owner: null,
        dueDate: '2026-04-25',
        linkedTaskId: null,
        createdAt: new Date('2026-04-18T12:00:00.000Z'),
        completedAt: null,
      },
    ]);
    const ctx = makeCtx(mockDb);
    const result = await getBrandActionItems.handler({ brandId: BRAND_ID, limit: 100 }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'ai-1',
      status: 'open',
      dueDate: '2026-04-25',
      createdAt: '2026-04-18T12:00:00.000Z',
    });
  });

  it('requires a valid brandId UUID', () => {
    expect(() => getBrandActionItems.inputSchema.parse({ brandId: 'not-a-uuid' })).toThrow();
  });
});

describe('getBrandMeetings', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getBrandMeetings.name).toBe('getBrandMeetings');
    expect(getBrandMeetings.readOnly).toBe(true);
    expect(getBrandMeetings.description).toMatch(/meetings for a specific brand/i);
  });

  it('returns meeting rows with ISO createdAt', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: 'mt-1',
        brandId: BRAND_ID,
        title: 'Weekly ops',
        date: '2026-04-18',
        attendees: ['Sara', 'Ryan'],
        source: 'manual',
        summary: 'All good.',
        decisions: [],
        externalMeetingId: null,
        recordingUrl: null,
        createdAt: new Date('2026-04-18T12:00:00.000Z'),
      },
    ]);
    const ctx = makeCtx(mockDb);
    const result = await getBrandMeetings.handler({ brandId: BRAND_ID, limit: 20 }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]!.createdAt).toBe('2026-04-18T12:00:00.000Z');
    expect(result[0]!.attendees).toEqual(['Sara', 'Ryan']);
  });

  it('rejects malformed dates', () => {
    expect(() =>
      getBrandMeetings.inputSchema.parse({ brandId: BRAND_ID, dateFrom: '04/19/2026' }),
    ).toThrow();
  });
});
