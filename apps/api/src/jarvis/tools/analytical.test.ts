import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import type { ToolContext, JarvisLogger } from './types.ts';
import { getBrandsRequiringAttention } from './analytical.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const NOW = new Date('2026-04-19T12:00:00.000Z'); // 2026-04-19 UTC

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

describe('getBrandsRequiringAttention', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getBrandsRequiringAttention.name).toBe('getBrandsRequiringAttention');
    expect(getBrandsRequiringAttention.readOnly).toBe(true);
    expect(getBrandsRequiringAttention.description).toMatch(/attention|risk|slipping/i);
  });

  it('exposes its scoring formula in the output', async () => {
    const mockDb = createMockDb();
    // No active brands → four empty result sets.
    mockDb._pushResult([]);
    mockDb._pushResult([]);
    mockDb._pushResult([]);
    mockDb._pushResult([]);
    const ctx = makeCtx(mockDb);

    const result = await getBrandsRequiringAttention.handler({ limit: 20 }, ctx);
    expect(result.scoringFormula).toMatch(/score = /);
    expect(result.brands).toEqual([]);
  });

  it('ranks a brand with overdue items + old meeting above a fresh brand', async () => {
    const riskyBrandId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const freshBrandId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    const mockDb = createMockDb();
    // active brands
    mockDb._pushResult([
      { id: riskyBrandId, name: 'Risky', status: 'active' },
      { id: freshBrandId, name: 'Fresh', status: 'active' },
    ]);
    // action item stats — only Risky has items
    mockDb._pushResult([{ brandId: riskyBrandId, openCount: 4, overdueCount: 2 }]);
    // last meetings — Risky 30 days ago, Fresh yesterday
    mockDb._pushResult([
      { brandId: riskyBrandId, lastDate: '2026-03-20' }, // 30 days before NOW
      { brandId: freshBrandId, lastDate: '2026-04-18' }, // 1 day before NOW
    ]);
    // last events — similar spread
    mockDb._pushResult([
      { brandId: riskyBrandId, lastCreatedAt: new Date('2026-03-20T12:00:00.000Z') },
      { brandId: freshBrandId, lastCreatedAt: new Date('2026-04-18T12:00:00.000Z') },
    ]);
    const ctx = makeCtx(mockDb);

    const result = await getBrandsRequiringAttention.handler({ limit: 20 }, ctx);

    expect(result.brands).toHaveLength(2);
    const [first, second] = result.brands;
    expect(first!.id).toBe(riskyBrandId);
    expect(second!.id).toBe(freshBrandId);
    expect(first!.attentionScore).toBeGreaterThan(second!.attentionScore);

    expect(first!.signals.overdueActionItems).toBe(2);
    expect(first!.signals.openActionItems).toBe(4);
    expect(first!.signals.daysSinceLastMeeting).toBe(30);
    expect(first!.signals.daysSinceLastEvent).toBe(30);
    expect(first!.reasons).toEqual(
      expect.arrayContaining([
        '2 overdue action items',
        '30 days since last meeting',
        '30 days since last activity',
      ]),
    );

    expect(second!.signals.overdueActionItems).toBe(0);
    expect(second!.signals.openActionItems).toBe(0);
    expect(second!.signals.daysSinceLastMeeting).toBe(1);
    expect(second!.reasons).toEqual([]); // nothing notable
  });

  it('surfaces "No meetings recorded" for brands with no history', async () => {
    const newBrandId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const mockDb = createMockDb();
    mockDb._pushResult([{ id: newBrandId, name: 'NewCo', status: 'active' }]);
    mockDb._pushResult([]); // no action items
    mockDb._pushResult([]); // no meetings
    mockDb._pushResult([]); // no events
    const ctx = makeCtx(mockDb);

    const result = await getBrandsRequiringAttention.handler({ limit: 20 }, ctx);
    expect(result.brands).toHaveLength(1);
    expect(result.brands[0]!.signals.daysSinceLastMeeting).toBeNull();
    expect(result.brands[0]!.signals.daysSinceLastEvent).toBeNull();
    expect(result.brands[0]!.reasons).toEqual(
      expect.arrayContaining(['No meetings recorded', 'No recorded activity']),
    );
  });

  it('respects the input limit', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult(
      Array.from({ length: 5 }, (_, i) => ({
        id: `dddddddd-dddd-dddd-dddd-${i.toString().padStart(12, '0')}`,
        name: `Brand ${i}`,
        status: 'active',
      })),
    );
    mockDb._pushResult([]);
    mockDb._pushResult([]);
    mockDb._pushResult([]);
    const ctx = makeCtx(mockDb);

    const result = await getBrandsRequiringAttention.handler({ limit: 2 }, ctx);
    expect(result.brands).toHaveLength(2);
  });

  it('applies the limit default (20) when no input given', () => {
    const parsed = getBrandsRequiringAttention.inputSchema.parse({});
    expect(parsed.limit).toBe(20);
  });

  it('rejects limits outside [1, 50]', () => {
    expect(() => getBrandsRequiringAttention.inputSchema.parse({ limit: 0 })).toThrow();
    expect(() => getBrandsRequiringAttention.inputSchema.parse({ limit: 51 })).toThrow();
  });
});
