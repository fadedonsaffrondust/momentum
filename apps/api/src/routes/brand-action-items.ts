import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, desc, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import {
  brandActionItemSchema,
  brandActionStatusSchema,
  createBrandActionItemInputSchema,
  updateBrandActionItemInputSchema,
  sendActionItemToTodayInputSchema,
  taskSchema,
  toLocalIsoDate,
} from '@momentum/shared';
import { brandActionItems, brandMeetings, brands, tasks } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrandActionItem, mapTask } from '../mappers.ts';
import { notFound } from '../errors.ts';
import { recordBrandEvent, recordInboxEvent } from '../services/events.ts';

const brandIdParam = z.object({ brandId: z.string().uuid() });
const idParam = z.object({ brandId: z.string().uuid(), id: z.string().uuid() });

/** Fields whose change in a PATCH fires `action_item_edited` inbox events. */
const EDIT_NOTIFY_FIELDS = ['text', 'dueDate', 'owner'] as const;

export const brandActionItemsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/brands/:brandId/action-items',
    {
      schema: {
        params: brandIdParam,
        querystring: z.object({ status: brandActionStatusSchema.optional() }),
        response: { 200: z.array(brandActionItemSchema) },
      },
    },
    async (req) => {
      const conds = [eq(brandActionItems.brandId, req.params.brandId)];
      if (req.query.status) conds.push(eq(brandActionItems.status, req.query.status));
      const rows = await db
        .select({
          ...getTableColumns(brandActionItems),
          meetingDate: brandMeetings.date,
        })
        .from(brandActionItems)
        .leftJoin(brandMeetings, eq(brandActionItems.meetingId, brandMeetings.id))
        .where(and(...conds))
        .orderBy(desc(brandMeetings.date), desc(brandActionItems.createdAt));
      return rows.map(mapBrandActionItem);
    },
  );

  app.post(
    '/brands/:brandId/action-items',
    {
      schema: {
        params: brandIdParam,
        body: createBrandActionItemInputSchema,
        response: { 200: brandActionItemSchema },
      },
    },
    async (req) => {
      const assigneeId = req.body.assigneeId ?? null;

      const [row] = await db
        .insert(brandActionItems)
        .values({
          brandId: req.params.brandId,
          creatorId: req.userId,
          assigneeId,
          text: req.body.text,
          meetingId: req.body.meetingId ?? null,
          owner: req.body.owner ?? null,
          dueDate: req.body.dueDate ?? null,
        })
        .returning();
      if (!row) throw new Error('Failed to create action item');

      await db
        .update(brands)
        .set({ updatedAt: new Date() })
        .where(eq(brands.id, req.params.brandId));

      await recordBrandEvent({
        brandId: req.params.brandId,
        actorId: req.userId,
        eventType: 'action_item_created',
        entityType: 'brand_action_item',
        entityId: row.id,
        payload: { text: row.text, assigneeId },
      });

      if (assigneeId && assigneeId !== req.userId) {
        await recordInboxEvent({
          userId: assigneeId,
          actorId: req.userId,
          eventType: 'action_item_assigned',
          entityType: 'brand_action_item',
          entityId: row.id,
          payload: { text: row.text, brandId: req.params.brandId },
        });
      }

      return mapBrandActionItem(row);
    },
  );

  app.patch(
    '/brands/:brandId/action-items/:id',
    {
      schema: {
        params: idParam,
        body: updateBrandActionItemInputSchema,
        response: { 200: brandActionItemSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(brandActionItems)
        .where(
          and(
            eq(brandActionItems.id, req.params.id),
            eq(brandActionItems.brandId, req.params.brandId),
          ),
        )
        .limit(1);
      if (!existing) throw notFound('Action item not found');

      const body = req.body;
      const isReassignment =
        body.assigneeId !== undefined && body.assigneeId !== existing.assigneeId;
      const isStatusChange =
        body.status !== undefined && body.status !== existing.status;

      const updates: Record<string, unknown> = { ...body };
      if (isStatusChange && body.status === 'done') {
        updates.completedAt = new Date();
      } else if (isStatusChange && body.status === 'open') {
        // Reopen clears the completion timestamp.
        updates.completedAt = null;
      }

      const [row] = await db
        .update(brandActionItems)
        .set(updates)
        .where(
          and(
            eq(brandActionItems.id, req.params.id),
            eq(brandActionItems.brandId, req.params.brandId),
          ),
        )
        .returning();
      if (!row) throw notFound('Action item not found');

      // Status-transition brand events.
      if (isStatusChange && body.status === 'done') {
        await recordBrandEvent({
          brandId: req.params.brandId,
          actorId: req.userId,
          eventType: 'action_item_completed',
          entityType: 'brand_action_item',
          entityId: row.id,
          payload: { text: row.text },
        });
      } else if (isStatusChange && body.status === 'open') {
        await recordBrandEvent({
          brandId: req.params.brandId,
          actorId: req.userId,
          eventType: 'action_item_reopened',
          entityType: 'brand_action_item',
          entityId: row.id,
          payload: { text: row.text },
        });
      }

      // Reassignment brand + inbox events.
      if (isReassignment) {
        await recordBrandEvent({
          brandId: req.params.brandId,
          actorId: req.userId,
          eventType: 'action_item_assigned',
          entityType: 'brand_action_item',
          entityId: row.id,
          payload: {
            text: row.text,
            previousAssigneeId: existing.assigneeId,
            assigneeId: row.assigneeId,
          },
        });
        if (row.assigneeId && row.assigneeId !== req.userId) {
          await recordInboxEvent({
            userId: row.assigneeId,
            actorId: req.userId,
            eventType: 'action_item_assigned',
            entityType: 'brand_action_item',
            entityId: row.id,
            payload: { text: row.text, brandId: req.params.brandId },
          });
        }
      }

      // Non-reassignment, non-status edits: text / dueDate / owner.
      const changedNotifyFields = EDIT_NOTIFY_FIELDS.filter((f) => f in body);
      if (changedNotifyFields.length > 0) {
        await recordBrandEvent({
          brandId: req.params.brandId,
          actorId: req.userId,
          eventType: 'action_item_edited',
          entityType: 'brand_action_item',
          entityId: row.id,
          payload: { changedFields: changedNotifyFields, text: row.text },
        });
        if (row.assigneeId && row.assigneeId !== req.userId) {
          await recordInboxEvent({
            userId: row.assigneeId,
            actorId: req.userId,
            eventType: 'action_item_edited',
            entityType: 'brand_action_item',
            entityId: row.id,
            payload: {
              changedFields: changedNotifyFields,
              text: row.text,
              brandId: req.params.brandId,
            },
          });
        }
      }

      return mapBrandActionItem(row);
    },
  );

  app.delete(
    '/brands/:brandId/action-items/:id',
    {
      schema: {
        params: idParam,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [row] = await db
        .delete(brandActionItems)
        .where(
          and(
            eq(brandActionItems.id, req.params.id),
            eq(brandActionItems.brandId, req.params.brandId),
          ),
        )
        .returning({ id: brandActionItems.id });
      if (!row) throw notFound('Action item not found');
      return { ok: true as const };
    },
  );

  /**
   * Send an action item to the assignee's Today. The assignee MUST be
   * specified explicitly — the frontend opens AssigneePickerModal before
   * hitting this route (spec §9.6, §9.12). Creates a linked task and
   * writes an inbox `task_assigned` event if assignee ≠ actor.
   */
  app.post(
    '/brands/:brandId/action-items/:id/send-to-today',
    {
      schema: {
        params: idParam,
        body: sendActionItemToTodayInputSchema,
        response: { 200: z.object({ actionItem: brandActionItemSchema, task: taskSchema }) },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(brandActionItems)
        .where(
          and(
            eq(brandActionItems.id, req.params.id),
            eq(brandActionItems.brandId, req.params.brandId),
          ),
        )
        .limit(1);
      if (!existing) throw notFound('Action item not found');

      const assigneeId = req.body.assigneeId;

      const [task] = await db
        .insert(tasks)
        .values({
          creatorId: req.userId,
          assigneeId,
          title: existing.text,
          scheduledDate: toLocalIsoDate(new Date()),
          priority: 'medium',
        })
        .returning();
      if (!task) throw new Error('Failed to create task');

      const [updated] = await db
        .update(brandActionItems)
        .set({ linkedTaskId: task.id })
        .where(eq(brandActionItems.id, existing.id))
        .returning();
      if (!updated) throw new Error('Failed to link action item');

      if (assigneeId !== req.userId) {
        await recordInboxEvent({
          userId: assigneeId,
          actorId: req.userId,
          eventType: 'task_assigned',
          entityType: 'task',
          entityId: task.id,
          payload: {
            title: task.title,
            source: 'action_item',
            brandId: req.params.brandId,
          },
        });
      }

      return { actionItem: mapBrandActionItem(updated), task: mapTask(task) };
    },
  );

  app.post(
    '/brands/:brandId/action-items/:id/complete',
    {
      schema: {
        params: idParam,
        response: { 200: brandActionItemSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(brandActionItems)
        .where(
          and(
            eq(brandActionItems.id, req.params.id),
            eq(brandActionItems.brandId, req.params.brandId),
          ),
        )
        .limit(1);
      if (!existing) throw notFound('Action item not found');

      const wasOpen = existing.status === 'open';

      const [row] = await db
        .update(brandActionItems)
        .set({ status: 'done', completedAt: new Date() })
        .where(eq(brandActionItems.id, existing.id))
        .returning();
      if (!row) throw notFound('Action item not found');

      // Bidirectional sync: team-shared tasks no longer have user_id.
      // Any matching linked task is marked done regardless of assignee.
      if (existing.linkedTaskId) {
        await db
          .update(tasks)
          .set({ status: 'done', column: 'done', completedAt: new Date() })
          .where(eq(tasks.id, existing.linkedTaskId));
      }

      if (wasOpen) {
        await recordBrandEvent({
          brandId: req.params.brandId,
          actorId: req.userId,
          eventType: 'action_item_completed',
          entityType: 'brand_action_item',
          entityId: row.id,
          payload: { text: row.text },
        });
      }

      return mapBrandActionItem(row);
    },
  );
};
