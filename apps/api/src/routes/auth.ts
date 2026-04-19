import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import {
  registerInputSchema,
  loginInputSchema,
  authResponseSchema,
  authUserSchema,
} from '@momentum/shared';
import { users, userSettings } from '@momentum/db';
import { db } from '../db.ts';
import { badRequest, conflict, unauthorized } from '../errors.ts';
import { avatarColorForEmail } from '../lib/avatar-color.ts';

/**
 * Team-space is single-tenant (Omnirev). Domain allowlist on signup is
 * the tenant boundary; there is no separate team record.
 */
const ALLOWED_SIGNUP_DOMAINS = ['omnirev.ai'] as const;
const SIGNUP_DOMAIN_ERROR = `Signup is restricted to @${ALLOWED_SIGNUP_DOMAINS[0]} email addresses.`;
const DEACTIVATED_ACCOUNT_ERROR = 'This account has been deactivated.';

function extractDomain(email: string): string | null {
  const at = email.indexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/register',
    {
      // Tight rate limit: bcrypt(10) is intentionally CPU-expensive, so
      // even a small burst of registrations is enough to exhaust a worker.
      // Keyed by IP since unauthenticated.
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        body: registerInputSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => {
      const { email, password, userName } = req.body;

      const domain = extractDomain(email);
      if (
        !domain ||
        !ALLOWED_SIGNUP_DOMAINS.includes(domain as (typeof ALLOWED_SIGNUP_DOMAINS)[number])
      ) {
        throw badRequest(SIGNUP_DOMAIN_ERROR);
      }

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) throw conflict('Email already registered');

      const passwordHash = await bcrypt.hash(password, 10);
      const avatarColor = avatarColorForEmail(email);

      // user + user_settings are written in a single transaction so a
      // failed settings insert can't leave an orphaned user row that
      // blocks future re-registration with the same email.
      const user = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            avatarColor,
            // display_name intentionally left as '' (the default) — the
            // first-run wizard fills it via PATCH /users/me.
          })
          .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            avatarColor: users.avatarColor,
          });

        if (!created) throw new Error('Failed to create user');

        // user_settings.user_name is NOT NULL; seed it from the register body
        // or fall back to the email local-part. The value is no longer used
        // by the UI after team-space, but the column stays for v1.4 import
        // backward-compat (see spec §7.1 settings route).
        const seededUserName = userName ?? email.split('@')[0]!;
        await tx.insert(userSettings).values({ userId: created.id, userName: seededUserName });

        return created;
      });

      const token = await app.jwt.sign({ sub: user.id });
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
        },
      };
    },
  );

  app.post(
    '/auth/login',
    {
      // Same tight rate limit as register — bcrypt.compare is the cost.
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        body: loginInputSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => {
      const { email, password } = req.body;
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!row) throw unauthorized('Invalid credentials');

      const ok = await bcrypt.compare(password, row.passwordHash);
      if (!ok) throw unauthorized('Invalid credentials');

      if (row.deactivatedAt !== null) throw badRequest(DEACTIVATED_ACCOUNT_ERROR);

      const token = await app.jwt.sign({ sub: row.id });
      return {
        token,
        user: {
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          avatarColor: row.avatarColor,
        },
      };
    },
  );

  app.get(
    '/auth/me',
    {
      preHandler: [app.authenticate],
      schema: { response: { 200: authUserSchema } },
    },
    async (req) => {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          avatarColor: users.avatarColor,
        })
        .from(users)
        .where(eq(users.id, req.userId))
        .limit(1);
      if (!row) throw unauthorized();
      return row;
    },
  );
};
