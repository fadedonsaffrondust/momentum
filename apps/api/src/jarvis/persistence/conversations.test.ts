import { describe, it, expect } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import {
  createConversation,
  listConversationsByUser,
  getConversationForUser,
  archiveConversation,
  bumpConversationUpdatedAt,
} from './conversations.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const CONVERSATION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const OTHER_USER_ID = '00000000-0000-0000-0000-0000000000b2';

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONVERSATION_ID,
    userId: USER_ID,
    title: 'What did I ship yesterday?',
    createdAt: new Date('2026-04-18T09:00:00.000Z'),
    updatedAt: new Date('2026-04-19T12:00:00.000Z'),
    archivedAt: null,
    metadata: {},
    ...overrides,
  };
}

describe('createConversation', () => {
  it('inserts the row and returns a normalized record with default metadata', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow()]);

    const row = await createConversation(mockDb as unknown as Database, {
      userId: USER_ID,
      title: 'What did I ship yesterday?',
    });

    expect(row.id).toBe(CONVERSATION_ID);
    expect(row.userId).toBe(USER_ID);
    expect(row.title).toBe('What did I ship yesterday?');
    expect(row.metadata).toEqual({});
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('throws if the insert returned no row', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    await expect(
      createConversation(mockDb as unknown as Database, { userId: USER_ID, title: 't' }),
    ).rejects.toThrow(/returned no row/);
  });
});

describe('listConversationsByUser', () => {
  it('returns normalized rows', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow(), sampleRow({ id: 'other' })]);

    const rows = await listConversationsByUser(mockDb as unknown as Database, USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe(CONVERSATION_ID);
    expect(rows[1]!.id).toBe('other');
  });

  it('returns an empty array for a user with no conversations', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    const rows = await listConversationsByUser(mockDb as unknown as Database, OTHER_USER_ID);
    expect(rows).toEqual([]);
  });
});

describe('getConversationForUser', () => {
  it('returns the conversation when the owner matches', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow()]);
    const row = await getConversationForUser(
      mockDb as unknown as Database,
      CONVERSATION_ID,
      USER_ID,
    );
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(USER_ID);
  });

  it('returns null on ownership mismatch (so routes can 404)', async () => {
    const mockDb = createMockDb();
    // The WHERE clause in the query filters on both ID and userId; an
    // owner-mismatch therefore returns an empty row set.
    mockDb._pushResult([]);
    const row = await getConversationForUser(
      mockDb as unknown as Database,
      CONVERSATION_ID,
      OTHER_USER_ID,
    );
    expect(row).toBeNull();
  });
});

describe('archiveConversation + bumpConversationUpdatedAt', () => {
  it('both call update without failing', async () => {
    const mockDb = createMockDb();
    // Each UPDATE chain resolves to whatever's next in the queue; push
    // empty arrays for both.
    mockDb._pushResult([]);
    mockDb._pushResult([]);

    await archiveConversation(mockDb as unknown as Database, CONVERSATION_ID);
    await bumpConversationUpdatedAt(mockDb as unknown as Database, CONVERSATION_ID);

    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });
});
