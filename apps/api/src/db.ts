import { createDb } from '@momentum/db';
import { env } from './env.ts';

export const { db, client } = createDb({ connectionString: env.DATABASE_URL });
