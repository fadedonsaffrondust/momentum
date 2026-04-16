import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Database = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  connectionString: string;
  max?: number;
}

export function createDb({ connectionString, max = 10 }: CreateDbOptions): {
  db: Database;
  client: postgres.Sql;
} {
  const client = postgres(connectionString, { max, prepare: false });
  const db = drizzle(client, { schema });
  return { db, client };
}

export { schema };
export * from './schema.ts';
