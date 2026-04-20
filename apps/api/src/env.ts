import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load the repo-root .env (two levels up from src/).
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Where task attachments are written by the LocalDiskStorage adapter
  // (v1). Defaults to apps/api/.uploads (one level above src/). Replaced
  // by STORAGE_BACKEND=gcs|s3 once cloud storage lands — see docs/TODO.md.
  UPLOAD_DIR: z.string().default(path.resolve(__dirname, '../.uploads')),
  OPENAI_API_KEY: z.string().optional(),
  TLDV_API_KEY: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  // Jarvis (V1) — read by AnthropicProvider at construction. Left
  // optional here because test suites don't need it; the provider throws
  // clearly if instantiated without a key.
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
