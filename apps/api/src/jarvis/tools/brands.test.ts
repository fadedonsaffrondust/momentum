import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import type { ToolContext, JarvisLogger } from './types.ts';
import { getBrand } from './brands.ts';

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
