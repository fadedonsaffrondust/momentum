import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { InferSelectModel } from 'drizzle-orm';
import { taskAttachmentSchema, type TaskAttachment } from '@momentum/shared';
import { taskAttachments, tasks, type taskAttachments as _ta } from '@momentum/db';
import { db } from '../db.ts';
import { badRequest, notFound, unauthorized } from '../errors.ts';
import { storage } from '../services/storage/index.ts';

type DbTaskAttachment = InferSelectModel<typeof _ta>;

const MAX_BYTES = 10 * 1024 * 1024;

function downloadUrl(id: string): string {
  return `/attachments/${id}/download`;
}

function mapAttachment(row: DbTaskAttachment): TaskAttachment {
  return {
    id: row.id,
    taskId: row.taskId,
    uploaderId: row.uploaderId,
    kind: row.kind,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: downloadUrl(row.id),
    createdAt: row.createdAt.toISOString(),
  };
}

function deriveKind(mimeType: string): 'image' | 'file' {
  return mimeType.startsWith('image/') ? 'image' : 'file';
}

// Node's http module rejects non-Latin-1 characters in header values, which
// blows up the whole response mid-stream if the original filename contains
// e.g. em dashes or smart quotes (→ Chrome reports ERR_INVALID_RESPONSE).
// RFC 6266: emit an ASCII-safe `filename=` plus a percent-encoded
// `filename*=UTF-8''…` for clients that support it.
function buildContentDisposition(disposition: 'inline' | 'attachment', name: string): string {
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(name);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

const attachmentIdParam = z.object({ id: z.string().uuid() });
const taskIdParam = z.object({ taskId: z.string().uuid() });

export const taskAttachmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  /* ─────────────── upload ─────────────── */

  app.post(
    '/tasks/:taskId/attachments',
    {
      preHandler: [app.authenticate],
      schema: {
        params: taskIdParam,
        // Multipart body; cannot be Zod-validated. The handler reads the
        // file from req.file() and validates manually.
        response: { 200: taskAttachmentSchema },
      },
    },
    async (req) => {
      const { taskId } = req.params;

      // Confirm the target task exists before reading the body, so a bad
      // taskId fails fast (404) instead of after a slow upload.
      const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
      if (!task) throw notFound('Task not found');

      // @fastify/multipart's `req.file()` returns the next file part. With
      // attachFieldsToBody:false and a single-file UI, this is the only
      // part we expect.
      const part = await req.file();
      if (!part) throw badRequest('No file uploaded');

      const originalName = part.filename || 'untitled';
      const mimeType = part.mimetype || 'application/octet-stream';
      const kind = deriveKind(mimeType);

      // Reserve an attachment id BEFORE the upload so we can use it as the
      // storage key (taskId/attachmentId). Insert happens inside the tx
      // below; we just generate the uuid here.
      const attachmentId = crypto.randomUUID();
      const storageKey = `${taskId}/${attachmentId}`;

      // Stream the file directly from the multipart parser into storage.
      // No full buffer in memory. If the part exceeds the multipart limit
      // (10 MB, configured globally), the stream errors mid-pipeline and
      // we clean up the partial blob below.
      //
      // CRITICAL: do NOT attach a 'data' listener to part.file before
      // calling storage.put() — that switches the stream into flowing
      // mode and drains bytes into the listener before pipeline attaches
      // its writeStream consumer. The result is silently truncated /
      // empty files. The size comes back from storage via fs.stat after
      // the write commits.
      let putResult;
      try {
        putResult = await storage.put(storageKey, part.file, mimeType, 0);
      } catch (err) {
        // Best-effort cleanup of any partial blob. The original error is
        // re-thrown so the global error handler maps it to the right
        // status code (413 for size, 500 otherwise).
        await storage.delete(storageKey).catch(() => undefined);
        throw err;
      }

      // The multipart limit fires inside the stream; if it tripped, the
      // pipeline above rejects, but as a backstop we also detect the
      // truncated flag here.
      if (part.file.truncated) {
        await storage.delete(storageKey).catch(() => undefined);
        throw Object.assign(new Error('File exceeds the 10 MB upload limit'), {
          statusCode: 413,
          code: 'FILE_TOO_LARGE',
        });
      }

      const [row] = await db
        .insert(taskAttachments)
        .values({
          id: attachmentId,
          taskId,
          uploaderId: req.userId,
          kind,
          originalName,
          mimeType,
          sizeBytes: putResult.sizeBytes,
          storageKey,
        })
        .returning();

      if (!row) {
        await storage.delete(storageKey).catch(() => undefined);
        throw new Error('Failed to record attachment');
      }

      return mapAttachment(row);
    },
  );

  /* ─────────────── download ─────────────── */

  // Auth on this route accepts EITHER an Authorization header (default
  // path used by JS fetch) OR a `?token=` query param. The query path is
  // a v1 expedient so plain `<img src>` requests can authenticate without
  // setting headers — replaced by signed URLs once cloud storage lands.
  app.get(
    '/attachments/:id/download',
    {
      schema: {
        params: attachmentIdParam,
        querystring: z.object({ token: z.string().optional() }),
      },
    },
    async (req, reply) => {
      let userId: string | null = null;
      try {
        await req.jwtVerify();
        userId = (req.user as { sub: string }).sub;
      } catch {
        const queryToken = (req.query as { token?: string }).token;
        if (queryToken) {
          try {
            const decoded = await app.jwt.verify<{ sub: string }>(queryToken);
            userId = decoded.sub;
          } catch {
            userId = null;
          }
        }
      }

      if (!userId) throw unauthorized();

      const [row] = await db
        .select()
        .from(taskAttachments)
        .where(eq(taskAttachments.id, req.params.id));
      if (!row) throw notFound('Attachment not found');

      const { stream } = await storage.getStream(row.storageKey);
      const disposition = row.kind === 'image' ? 'inline' : 'attachment';
      void reply
        .header('Content-Type', row.mimeType)
        .header('Content-Length', row.sizeBytes.toString())
        .header('Content-Disposition', buildContentDisposition(disposition, row.originalName));
      return reply.send(stream);
    },
  );

  /* ─────────────── delete ─────────────── */

  app.delete(
    '/attachments/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        params: attachmentIdParam,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [row] = await db
        .delete(taskAttachments)
        .where(eq(taskAttachments.id, req.params.id))
        .returning({ storageKey: taskAttachments.storageKey });
      if (!row) throw notFound('Attachment not found');
      // Fire-and-forget — disk failure shouldn't unwind the DB delete.
      void storage.delete(row.storageKey).catch(() => undefined);
      return { ok: true as const };
    },
  );
};
