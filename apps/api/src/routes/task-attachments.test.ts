import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

const { mockDb } = vi.hoisted(() => {
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
      apply() {
        return chain;
      },
    });
    return chain;
  }
  const mockDb: any = {
    select: vi.fn((..._args: unknown[]) => createChain()),
    insert: vi.fn((..._args: unknown[]) => createChain()),
    update: vi.fn((..._args: unknown[]) => createChain()),
    delete: vi.fn((..._args: unknown[]) => createChain()),
    transaction: vi.fn(async (cb: (tx: typeof mockDb) => unknown) => cb(mockDb)),
    _results: results,
    _pushResult(value: unknown) {
      results.push(value);
    },
    _pushResults(...values: unknown[]) {
      results.push(...values);
    },
  };
  return { mockDb };
});

const { mockStorage } = vi.hoisted(() => {
  const mockStorage = {
    put: vi.fn(async (key: string) => ({ key })),
    getStream: vi.fn(async () => ({
      stream: Readable.from(Buffer.from('mock-bytes')),
      sizeBytes: 10,
      mimeType: 'application/octet-stream',
    })),
    delete: vi.fn(async () => undefined),
  };
  return { mockStorage };
});

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));
vi.mock('../services/storage/index.ts', () => ({ storage: mockStorage }));

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { taskAttachmentsRoutes } from './task-attachments.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TASK_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const ATTACHMENT_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

describe('task-attachments routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    await app.register(authPlugin);
    await app.register(taskAttachmentsRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
    mockStorage.put.mockClear();
    mockStorage.getStream.mockClear();
    mockStorage.delete.mockClear();
  });

  // ── POST /tasks/:taskId/attachments ────────────────────────────────

  it('rejects unauthenticated upload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/attachments`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when task does not exist', async () => {
    mockDb._pushResult([]); // task lookup empty

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/attachments`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'multipart/form-data; boundary=----test',
      },
      payload:
        '------test\r\nContent-Disposition: form-data; name="file"; filename="hi.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n------test--\r\n',
    });
    expect(res.statusCode).toBe(404);
  });

  // ── GET /attachments/:id/download ──────────────────────────────────

  it('rejects download with no auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/attachments/${ATTACHMENT_ID}/download`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects download with an invalid query token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/attachments/${ATTACHMENT_ID}/download?token=not-a-real-jwt`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('streams the file with valid Authorization header', async () => {
    mockDb._pushResult([
      {
        id: ATTACHMENT_ID,
        taskId: TASK_ID,
        uploaderId: USER_ID,
        kind: 'file',
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        storageKey: `${TASK_ID}/${ATTACHMENT_ID}`,
        createdAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/attachments/${ATTACHMENT_ID}/download`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="doc.pdf"');
    expect(mockStorage.getStream).toHaveBeenCalledWith(`${TASK_ID}/${ATTACHMENT_ID}`);
  });

  it('streams the file with a valid query token (image-tag friendly)', async () => {
    mockDb._pushResult([
      {
        id: ATTACHMENT_ID,
        taskId: TASK_ID,
        uploaderId: USER_ID,
        kind: 'image',
        originalName: 'shot.png',
        mimeType: 'image/png',
        sizeBytes: 10,
        storageKey: `${TASK_ID}/${ATTACHMENT_ID}`,
        createdAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/attachments/${ATTACHMENT_ID}/download?token=${token}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('inline; filename="shot.png"');
  });

  it('returns 404 when the attachment row is missing', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/attachments/${ATTACHMENT_ID}/download`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── DELETE /attachments/:id ────────────────────────────────────────

  it('rejects unauthenticated delete', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/attachments/${ATTACHMENT_ID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when the attachment row is gone', async () => {
    mockDb._pushResult([]); // delete returning empty

    const res = await app.inject({
      method: 'DELETE',
      url: `/attachments/${ATTACHMENT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('deletes the row and asks storage to remove the blob', async () => {
    mockDb._pushResult([{ storageKey: `${TASK_ID}/${ATTACHMENT_ID}` }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/attachments/${ATTACHMENT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockStorage.delete).toHaveBeenCalledWith(`${TASK_ID}/${ATTACHMENT_ID}`);
  });
});
