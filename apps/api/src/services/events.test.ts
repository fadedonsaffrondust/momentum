import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from '@momentum/db';
import { recordBrandEvent, recordInboxEvent } from './events.ts';

/**
 * Mock drizzle insert chain: `db.insert(table).values(...)` awaits to undefined.
 * Records what was inserted for assertions.
 */
function createMockDb(opts: { failOnInsert?: boolean } = {}): {
  db: Database;
  insertCalls: Array<{ table: unknown; values: unknown }>;
  insertMock: ReturnType<typeof vi.fn>;
} {
  const insertCalls: Array<{ table: unknown; values: unknown }> = [];
  const valuesMock = vi.fn((vals: unknown) => {
    const lastCall = insertCalls[insertCalls.length - 1];
    if (lastCall) lastCall.values = vals;
    if (opts.failOnInsert) return Promise.reject(new Error('simulated db failure'));
    return Promise.resolve(undefined);
  });
  const insertMock = vi.fn((table: unknown) => {
    insertCalls.push({ table, values: undefined });
    return { values: valuesMock } as unknown;
  });
  const db = { insert: insertMock } as unknown as Database;
  return { db, insertCalls, insertMock };
}

const BRAND_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ACTOR_ID = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const USER_ID = 'c2ffcd00-ad1c-5ff9-cc7e-7ccaae491b33';
const ENTITY_ID = 'd3ffcd00-ad1c-5ff9-cc7e-7ccaae491b44';

describe('recordBrandEvent', () => {
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('inserts a row with the expected shape', async () => {
    const { db, insertCalls, insertMock } = createMockDb();

    await recordBrandEvent(
      {
        brandId: BRAND_ID,
        actorId: ACTOR_ID,
        eventType: 'action_item_created',
        entityType: 'brand_action_item',
        entityId: ENTITY_ID,
        payload: { text: 'Follow up' },
      },
      db,
    );

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.values).toEqual({
      brandId: BRAND_ID,
      actorId: ACTOR_ID,
      eventType: 'action_item_created',
      entityType: 'brand_action_item',
      entityId: ENTITY_ID,
      payload: { text: 'Follow up' },
    });
  });

  it('defaults entityId to null and payload to {} when omitted', async () => {
    const { db, insertCalls } = createMockDb();

    await recordBrandEvent(
      {
        brandId: BRAND_ID,
        actorId: ACTOR_ID,
        eventType: 'brand_edited',
        entityType: 'brand',
      },
      db,
    );

    expect(insertCalls[0]?.values).toEqual({
      brandId: BRAND_ID,
      actorId: ACTOR_ID,
      eventType: 'brand_edited',
      entityType: 'brand',
      entityId: null,
      payload: {},
    });
  });

  it('swallows db errors — does not re-throw', async () => {
    const { db } = createMockDb({ failOnInsert: true });

    await expect(
      recordBrandEvent(
        {
          brandId: BRAND_ID,
          actorId: ACTOR_ID,
          eventType: 'brand_edited',
          entityType: 'brand',
        },
        db,
      ),
    ).resolves.toBeUndefined();

    expect(consoleErrSpy).toHaveBeenCalledTimes(1);
  });

  it('returns a Promise<void>', async () => {
    const { db } = createMockDb();
    const result = await recordBrandEvent(
      {
        brandId: BRAND_ID,
        actorId: ACTOR_ID,
        eventType: 'brand_edited',
        entityType: 'brand',
      },
      db,
    );
    expect(result).toBeUndefined();
  });
});

describe('recordInboxEvent', () => {
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('inserts a row when actor !== recipient', async () => {
    const { db, insertCalls, insertMock } = createMockDb();

    await recordInboxEvent(
      {
        userId: USER_ID,
        actorId: ACTOR_ID,
        eventType: 'task_assigned',
        entityType: 'task',
        entityId: ENTITY_ID,
        payload: { prevAssignee: null },
      },
      db,
    );

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertCalls[0]?.values).toEqual({
      userId: USER_ID,
      actorId: ACTOR_ID,
      eventType: 'task_assigned',
      entityType: 'task',
      entityId: ENTITY_ID,
      payload: { prevAssignee: null },
    });
  });

  it('is a no-op when actor === recipient (self-suppression)', async () => {
    const { db, insertMock } = createMockDb();

    await recordInboxEvent(
      {
        userId: ACTOR_ID,
        actorId: ACTOR_ID,
        eventType: 'task_edited',
        entityType: 'task',
        entityId: ENTITY_ID,
      },
      db,
    );

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('defaults payload to {}', async () => {
    const { db, insertCalls } = createMockDb();

    await recordInboxEvent(
      {
        userId: USER_ID,
        actorId: ACTOR_ID,
        eventType: 'parking_involvement',
        entityType: 'parking',
        entityId: ENTITY_ID,
      },
      db,
    );

    expect(insertCalls[0]?.values).toMatchObject({ payload: {} });
  });

  it('swallows db errors — does not re-throw', async () => {
    const { db } = createMockDb({ failOnInsert: true });

    await expect(
      recordInboxEvent(
        {
          userId: USER_ID,
          actorId: ACTOR_ID,
          eventType: 'task_assigned',
          entityType: 'task',
          entityId: ENTITY_ID,
        },
        db,
      ),
    ).resolves.toBeUndefined();

    expect(consoleErrSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call db.insert at all during self-suppression (not a catch-all)', async () => {
    const { db, insertMock } = createMockDb({ failOnInsert: true });

    // Self-suppression short-circuits before the try/catch, so even a
    // failing db is irrelevant — we should never have attempted the insert.
    await recordInboxEvent(
      {
        userId: ACTOR_ID,
        actorId: ACTOR_ID,
        eventType: 'task_edited',
        entityType: 'task',
        entityId: ENTITY_ID,
      },
      db,
    );

    expect(insertMock).not.toHaveBeenCalled();
  });
});
