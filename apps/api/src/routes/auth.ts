import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  registerInputSchema,
  loginInputSchema,
  authResponseSchema,
  authUserSchema,
} from '@momentum/shared';
import { users, userSettings } from '@momentum/db';
import { db } from '../db.ts';
import { conflict, unauthorized } from '../errors.ts';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/register',
    {
      schema: {
        body: registerInputSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => {
      const { email, password, userName } = req.body;

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) throw conflict('Email already registered');

      const passwordHash = await bcrypt.hash(password, 10);
      const [user] = await db
        .insert(users)
        .values({ email, passwordHash })
        .returning({ id: users.id, email: users.email });

      if (!user) throw new Error('Failed to create user');

      await db.insert(userSettings).values({ userId: user.id, userName });

      const token = await app.jwt.sign({ sub: user.id });
      return { token, user: { id: user.id, email: user.email } };
    },
  );

  app.post(
    '/auth/login',
    {
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

      const token = await app.jwt.sign({ sub: row.id });
      return { token, user: { id: row.id, email: row.email } };
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
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, req.userId))
        .limit(1);
      if (!row) throw unauthorized();
      return row;
    },
  );
};
