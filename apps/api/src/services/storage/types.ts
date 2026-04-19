import type { Readable } from 'node:stream';

/**
 * Pluggable blob-storage interface for task attachments. The v1
 * implementation (`LocalDiskStorage`) writes to the local filesystem
 * under `UPLOAD_DIR`. A future cloud implementation only needs to
 * satisfy this contract — routes, schema, and the frontend stay the same.
 *
 * The `key` is opaque to callers above the adapter — they get it back
 * from `put()` and store it in the `task_attachments.storage_key` column,
 * then pass it to `getStream()` / `delete()`. LocalDiskStorage uses
 * `<taskId>/<attachmentId>`; an S3 adapter would use the same string as
 * the object key.
 */
export interface PutResult {
  key: string;
}

export interface GetStreamResult {
  stream: Readable;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageAdapter {
  /**
   * Persist `stream` under `key`. Implementations are responsible for
   * directory / parent creation, atomic renames if needed, and reporting
   * any size mismatch (the route layer enforces the 10 MB cap upstream
   * via @fastify/multipart, so adapters can trust the byte count).
   */
  put(key: string, stream: Readable, mimeType: string, sizeBytes: number): Promise<PutResult>;

  /**
   * Open a readable stream for `key`. Throws if missing.
   */
  getStream(key: string): Promise<GetStreamResult>;

  /**
   * Remove the blob. No-op if it doesn't exist (idempotent — used in
   * cleanup paths where the disk file may already be gone).
   */
  delete(key: string): Promise<void>;
}
