import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { updateSettingsInputSchema, userSettingsSchema } from '@momentum/shared';
import { userSettings } from '@momentum/db';
import { db } from '../db.ts';
import { mapSettings } from '../mappers.ts';
import { notFound } from '../errors.ts';

export const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/settings', { schema: { response: { 200: userSettingsSchema } } }, async (req) => {
    const [row] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, req.userId))
      .limit(1);
    if (!row) throw notFound('Settings not found');
    return mapSettings(row);
  });

  app.put(
    '/settings',
    {
      schema: {
        body: updateSettingsInputSchema,
        response: { 200: userSettingsSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .update(userSettings)
        .set(req.body)
        .where(eq(userSettings.userId, req.userId))
        .returning();
      if (!row) throw notFound('Settings not found');
      return mapSettings(row);
    },
  );
};
