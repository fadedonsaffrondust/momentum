import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, asc, max } from 'drizzle-orm';
import { z } from 'zod';
import { roleSchema, createRoleInputSchema, ROLE_COLOR_PALETTE } from '@momentum/shared';
import { roles } from '@momentum/db';
import { db } from '../db.ts';
import { mapRole } from '../mappers.ts';
import { notFound } from '../errors.ts';

export const rolesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/roles',
    { schema: { response: { 200: z.array(roleSchema) } } },
    async (req) => {
      const rows = await db
        .select()
        .from(roles)
        .where(eq(roles.userId, req.userId))
        .orderBy(asc(roles.position));
      return rows.map(mapRole);
    },
  );

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

      const [{ maxPos }] = (await db
        .select({ maxPos: max(roles.position) })
        .from(roles)
        .where(eq(roles.userId, req.userId))) as [{ maxPos: number | null }];

      const nextPosition = (maxPos ?? -1) + 1;
      const resolvedColor =
        color ?? ROLE_COLOR_PALETTE[nextPosition % ROLE_COLOR_PALETTE.length]!;

      const [row] = await db
        .insert(roles)
        .values({
          userId: req.userId,
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
      const [row] = await db
        .update(roles)
        .set(req.body)
        .where(and(eq(roles.id, req.params.id), eq(roles.userId, req.userId)))
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
        .where(and(eq(roles.id, req.params.id), eq(roles.userId, req.userId)))
        .returning({ id: roles.id });
      if (!row) throw notFound('Role not found');
      return { ok: true as const };
    },
  );
};
