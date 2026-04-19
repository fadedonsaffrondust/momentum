// TODO(storage): swap to GcsStorage / S3Storage when cloud storage lands
// — see docs/TODO.md "GCS / S3 storage adapter for task attachments". The
// adapter contract (services/storage/types.ts) is the only surface a new
// backend needs to satisfy; routes / DB / frontend stay unchanged.
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { GetStreamResult, PutResult, StorageAdapter } from './types.ts';

export class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly rootDir: string) {}

  async put(
    key: string,
    stream: Readable,
    mimeType: string,
    _sizeBytes: number,
  ): Promise<PutResult> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await pipeline(stream, createWriteStream(target));
    // mimeType + size are recorded in the DB row, not in the file itself.
    void mimeType;
    return { key };
  }

  async getStream(key: string): Promise<GetStreamResult> {
    const target = this.resolve(key);
    const info = await stat(target);
    return {
      stream: createReadStream(target),
      sizeBytes: info.size,
      mimeType: 'application/octet-stream', // mime is the route's concern (DB column)
    };
  }

  async delete(key: string): Promise<void> {
    const target = this.resolve(key);
    try {
      await unlink(target);
    } catch (err) {
      // ENOENT is fine — the cleanup path is idempotent.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    // Best-effort: remove the parent directory if it became empty so the
    // upload tree doesn't accumulate dead per-task folders forever.
    try {
      await rmdir(path.dirname(target));
    } catch {
      // Non-empty or already gone — ignore.
    }
  }

  /**
   * Resolve a storage key to an absolute path INSIDE the configured root.
   * Throws if the resulting path escapes the root (defense in depth — the
   * route layer should never pass a user-controlled key, but the check is
   * cheap insurance against an upstream bug).
   */
  private resolve(key: string): string {
    const resolved = path.resolve(this.rootDir, key);
    const rootResolved = path.resolve(this.rootDir);
    if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
      throw new Error(`Storage key "${key}" escapes the upload root`);
    }
    return resolved;
  }
}
