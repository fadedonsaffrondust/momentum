import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

const { mockDb, mockRecordBrandEvent, mockResolveAttendees } = vi.hoisted(() => {
  const results: unknown[] = [];
  function createChain(): any {
    const chain: any = new Proxy(() => {}, {
      get(_target: any, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            const result = results.shift();
            if (result instanceof Error) reject(result);
            else resolve(result);
          };
        }
        return (..._args: unknown[]) => chain;
      },
      apply() { return chain; },
    });
    return chain;
  }
  const mockDb = {
    select: vi.fn((..._args: unknown[]) => createChain()),
    insert: vi.fn((..._args: unknown[]) => createChain()),
    update: vi.fn((..._args: unknown[]) => createChain()),
    delete: vi.fn((..._args: unknown[]) => createChain()),
    _results: results,
    _pushResult(value: unknown) { results.push(value); },
    _pushResults(...values: unknown[]) { results.push(...values); },
  };
  const mockRecordBrandEvent = vi.fn(async (..._args: unknown[]) => undefined);
  const mockResolveAttendees = vi.fn(async (..._args: unknown[]) => [] as string[]);
  return { mockDb, mockRecordBrandEvent, mockResolveAttendees };
});

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));
vi.mock('../services/events.ts', () => ({
  recordBrandEvent: mockRecordBrandEvent,
  recordInboxEvent: vi.fn(async () => undefined),
}));
vi.mock('../lib/attendees.ts', async () => {
  const actual = await vi.importActual<typeof import('../lib/attendees.ts')>('../lib/attendees.ts');
  return {
    ...actual,
    resolveAttendeeUserIds: mockResolveAttendees,
  };
});

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { brandMeetingsRoutes } from './brand-meetings.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SARA_ID = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const BRAND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MEETING_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-17T12:00:00Z');

function makeMeetingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MEETING_ID,
    brandId: BRAND_ID,
    date: '2026-04-17',
    title: 'Weekly sync',
    attendees: [],
    attendeeUserIds: [],
    summary: null,
    rawNotes: '',
    decisions: [],
    source: 'manual',
    externalMeetingId: null,
    recordingUrl: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('brand meetings routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(brandMeetingsRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
    mockRecordBrandEvent.mockClear();
    mockResolveAttendees.mockReset();
    mockResolveAttendees.mockResolvedValue([]);
  });

  // ── GET ────────────────────────────────────────────────────────────

  it('GET returns the team-shared list', async () => {
    mockDb._pushResult([
      makeMeetingRow(),
      makeMeetingRow({ id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/meetings`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(2);
  });

  // ── POST ───────────────────────────────────────────────────────────

  it('POST populates attendeeUserIds via the resolver + emits meeting_added', async () => {
    mockResolveAttendees.mockResolvedValue([SARA_ID]);
    mockDb._pushResult([
      makeMeetingRow({
        attendees: ['sara@omnirev.ai', 'client@foo.com'],
        attendeeUserIds: [SARA_ID],
      }),
    ]); // insert returning
    mockDb._pushResult(undefined); // update brands.updatedAt

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/meetings`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        date: '2026-04-17',
        title: 'Kickoff',
        attendees: ['sara@omnirev.ai', 'client@foo.com'],
        rawNotes: 'Notes',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.attendeeUserIds).toEqual([SARA_ID]);
    expect(mockResolveAttendees).toHaveBeenCalledWith(['sara@omnirev.ai', 'client@foo.com']);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'meeting_added',
      entityType: 'brand_meeting',
      entityId: MEETING_ID,
      payload: expect.objectContaining({ title: 'Weekly sync', date: '2026-04-17' }),
    });
  });

  it('POST with no team-email attendees stores empty attendeeUserIds', async () => {
    mockResolveAttendees.mockResolvedValue([]);
    mockDb._pushResult([
      makeMeetingRow({ attendees: ['Jane Doe', 'client@foo.com'], attendeeUserIds: [] }),
    ]);
    mockDb._pushResult(undefined);

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/meetings`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        date: '2026-04-17',
        title: 'Client call',
        attendees: ['Jane Doe', 'client@foo.com'],
        rawNotes: '',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).attendeeUserIds).toEqual([]);
  });

  // ── PATCH ──────────────────────────────────────────────────────────

  it('PATCH changing attendees recomputes attendeeUserIds + emits meeting_edited', async () => {
    const existing = makeMeetingRow({
      attendees: ['old@external.com'],
      attendeeUserIds: [],
    });
    mockResolveAttendees.mockResolvedValue([SARA_ID]);
    mockDb._pushResult([existing]); // select existing
    mockDb._pushResult([
      { ...existing, attendees: ['sara@omnirev.ai'], attendeeUserIds: [SARA_ID] },
    ]); // update returning

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/meetings/${MEETING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { attendees: ['sara@omnirev.ai'] },
    });

    expect(res.statusCode).toBe(200);
    expect(mockResolveAttendees).toHaveBeenCalledWith(['sara@omnirev.ai']);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'meeting_edited',
      payload: expect.objectContaining({ changedFields: ['attendees'] }),
    });
  });

  it('PATCH without attendees change does NOT re-run the resolver', async () => {
    const existing = makeMeetingRow({ attendees: ['sara@omnirev.ai'], attendeeUserIds: [SARA_ID] });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, summary: 'Updated summary' }]);

    await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/meetings/${MEETING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { summary: 'Updated summary' },
    });

    expect(mockResolveAttendees).not.toHaveBeenCalled();
  });

  it('PATCH returns 404 when meeting is absent', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/meetings/${MEETING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { summary: 'x' },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
  });

  // ── DELETE ─────────────────────────────────────────────────────────

  it('DELETE emits meeting_deleted BEFORE removing (invocation-order check)', async () => {
    mockDb._pushResult([{ id: MEETING_ID, title: 'Weekly sync', date: '2026-04-17' }]);
    mockDb._pushResult([{ id: MEETING_ID }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/meetings/${MEETING_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'meeting_deleted',
      entityType: 'brand_meeting',
      entityId: MEETING_ID,
      payload: expect.objectContaining({ title: 'Weekly sync' }),
    });
    const eventCallOrder = mockRecordBrandEvent.mock.invocationCallOrder[0]!;
    const deleteCallOrder = mockDb.delete.mock.invocationCallOrder[0]!;
    expect(eventCallOrder).toBeLessThan(deleteCallOrder);
  });

  it('DELETE returns 404 when meeting is absent', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/meetings/${MEETING_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
