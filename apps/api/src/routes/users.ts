import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { authUserSchema, updateMeInputSchema, userSummarySchema } from '@momentum/shared';
import { users } from '@momentum/db';
import { db } from '../db.ts';
import { mapUserSummary } from '../mappers.ts';
import { notFound } from '../errors.ts';

/**
 * User-identity routes for team space.
 *
 * - `GET /users` — active team roster (excludes deactivated users).
 * - `GET /users/:id` — single user, including deactivated ones so the
 *   frontend can still hydrate avatars in historical contexts.
 * - `PATCH /users/me` — used by the first-run wizard to set display name.
 */
export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/users',
    {
      preHandler: [app.authenticate],
      schema: { response: { 200: z.array(userSummarySchema) } },
    },
    async () => {
      const rows = await db
        .select()
        .from(users)
        .where(isNull(users.deactivatedAt))
        .orderBy(asc(users.displayName), asc(users.email));
      return rows.map(mapUserSummary);
    },
  );

  app.get(
    '/users/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: userSummarySchema },
      },
    },
    async (req) => {
      const [row] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
      if (!row) throw notFound('User not found');
      return mapUserSummary(row);
    },
  );

  app.patch(
    '/users/me',
    {
      preHandler: [app.authenticate],
      schema: {
        body: updateMeInputSchema,
        response: { 200: authUserSchema },
      },
    },
    async (req) => {
      const { displayName } = req.body;

      const [updated] = await db
        .update(users)
        .set({ displayName })
        .where(eq(users.id, req.userId))
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          avatarColor: users.avatarColor,
        });

      if (!updated) throw notFound('User not found');
      return updated;
    },
  );
};
