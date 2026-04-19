// TODO(storage): when GCS / S3 lands, switch on env.STORAGE_BACKEND here
// (default 'local'). New backend = one new file implementing StorageAdapter
// + add a case below + document env vars in .env.example.
import { env } from '../../env.ts';
import { LocalDiskStorage } from './local.ts';
import type { StorageAdapter } from './types.ts';

export type { StorageAdapter } from './types.ts';

export const storage: StorageAdapter = new LocalDiskStorage(env.UPLOAD_DIR);
