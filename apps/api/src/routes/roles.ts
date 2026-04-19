import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, ne, and, asc, max, sql } from 'drizzle-orm';
import { z } from 'zod';
import { roleSchema, createRoleInputSchema, ROLE_COLOR_PALETTE } from '@momentum/shared';
import { roles } from '@momentum/db';
import { db } from '../db.ts';
import { mapRole } from '../mappers.ts';
import { conflict, notFound } from '../errors.ts';

/**
 * Roles are team-wide in team-space (spec §5.2). Any authenticated user
 * may read, create, update, or delete — edits affect everyone (flat perms
 * per §4.4). Position is a single team-wide sort order, not per-user.
 */
export const rolesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/roles', { schema: { response: { 200: z.array(roleSchema) } } }, async () => {
    const rows = await db.select().from(roles).orderBy(asc(roles.position));
    return rows.map(mapRole);
  });

  app.post(
    '/roles',
    {
      schema: {
        body: createRoleInputSchema,
        response: { 200: roleSchema },
      },
    },
    async (req) => {
      const { name, color } = req.body;

      // Case-insensitive duplicate check for a friendly 409. The DB has a
      // functional unique index on LOWER(name) as a backstop if this check
      // is ever bypassed.
      const [existing] = await db
        .select({ name: roles.name })
        .from(roles)
        .where(sql`LOWER(${roles.name}) = LOWER(${name})`)
        .limit(1);
      if (existing) {
        throw conflict(`A role named "${existing.name}" already exists.`);
      }

      const [{ maxPos }] = (await db.select({ maxPos: max(roles.position) }).from(roles)) as [
        { maxPos: number | null },
      ];

      const nextPosition = (maxPos ?? -1) + 1;
      const resolvedColor = color ?? ROLE_COLOR_PALETTE[nextPosition % ROLE_COLOR_PALETTE.length]!;

      const [row] = await db
        .insert(roles)
        .values({
          name,
          color: resolvedColor,
          position: nextPosition,
        })
        .returning();
      if (!row) throw new Error('Failed to create role');
      return mapRole(row);
    },
  );

  app.patch(
    '/roles/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: roleSchema.pick({ name: true, color: true, position: true }).partial(),
        response: { 200: roleSchema },
      },
    },
    async (req) => {
      // If the rename would collide with another role (case-insensitive),
      // surface a 409 before the DB unique index fires so the client gets a
      // clean error message instead of a raw integrity violation.
      if (req.body.name !== undefined) {
        const [existing] = await db
          .select({ name: roles.name })
          .from(roles)
          .where(
            and(sql`LOWER(${roles.name}) = LOWER(${req.body.name})`, ne(roles.id, req.params.id)),
          )
          .limit(1);
        if (existing) {
          throw conflict(`A role named "${existing.name}" already exists.`);
        }
      }

      const [row] = await db
        .update(roles)
        .set(req.body)
        .where(eq(roles.id, req.params.id))
        .returning();
      if (!row) throw notFound('Role not found');
      return mapRole(row);
    },
  );

  app.delete(
    '/roles/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [row] = await db
        .delete(roles)
        .where(eq(roles.id, req.params.id))
        .returning({ id: roles.id });
      if (!row) throw notFound('Role not found');
      return { ok: true as const };
    },
  );
};
