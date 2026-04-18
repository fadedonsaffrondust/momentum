-- Team Space V1 — transforms single-user Momentum into a one-team operating
-- system. Backfills existing Nader-only data so it survives the cutover.
-- Companion TS runner (pnpm db:migrate:team-space-backfill) refreshes
-- avatar_color + brand_meetings.attendee_user_ids[] after this SQL completes.

-- ─────────────── parking_visibility enum ───────────────
CREATE TYPE "public"."parking_visibility" AS ENUM('team', 'private');--> statement-breakpoint

-- ─────────────── users: display_name, avatar_color, deactivated_at ───────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_color" text NOT NULL DEFAULT '#0FB848';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp with time zone;--> statement-breakpoint

-- Backfill display_name from user_settings.user_name, falling back to email local-part.
UPDATE "users" u
SET "display_name" = COALESCE(
  NULLIF(us.user_name, ''),
  split_part(u.email, '@', 1)
)
FROM "user_settings" us
WHERE us.user_id = u.id AND u.display_name = '';--> statement-breakpoint

-- Fallback for users with no user_settings row (shouldn't exist today but be safe).
UPDATE "users"
SET "display_name" = split_part(email, '@', 1)
WHERE "display_name" = '';--> statement-breakpoint

-- Backfill avatar_color deterministically from email hash, selecting from
-- ROLE_COLOR_PALETTE (kept in sync with packages/shared/src/schemas.ts).
-- abs(hashtext(x)) may be INT_MIN, so wrap in mod and + 1 for 1-based array idx.
UPDATE "users"
SET "avatar_color" = (
  ARRAY[
    '#0FB848', -- green (brand)
    '#F7B24F', -- amber
    '#4FD1C5', -- teal
    '#F76C6C', -- red
    '#B184F7', -- purple
    '#4F8EF7', -- blue
    '#F78FB3', -- pink
    '#FFD93D'  -- yellow
  ]::text[]
)[(abs(hashtext(email)) % 8) + 1];--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_users_active" ON "users" ("id") WHERE "deactivated_at" IS NULL;--> statement-breakpoint

-- ─────────────── roles: drop user_id (team-wide) ───────────────
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "roles_user_id_idx";--> statement-breakpoint
ALTER TABLE "roles" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- ─────────────── tasks: rename user_id → assignee_id, add creator_id ───────────────
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "tasks_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tasks_scheduled_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tasks_status_idx";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "user_id" TO "assignee_id";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "creator_id" uuid;--> statement-breakpoint
UPDATE "tasks" SET "creator_id" = "assignee_id" WHERE "creator_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "creator_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_assignee_id_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_creator" ON "tasks" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_assignee_scheduled" ON "tasks" USING btree ("assignee_id", "scheduled_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("assignee_id", "status");--> statement-breakpoint

-- ─────────────── parkings: rename user_id → creator_id, add visibility/involved ───────────────
ALTER TABLE "parkings" DROP CONSTRAINT IF EXISTS "parkings_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "parkings_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "parkings_target_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "parkings_status_idx";--> statement-breakpoint
ALTER TABLE "parkings" RENAME COLUMN "user_id" TO "creator_id";--> statement-breakpoint
ALTER TABLE "parkings" ADD COLUMN IF NOT EXISTS "visibility" "parking_visibility" NOT NULL DEFAULT 'team';--> statement-breakpoint
ALTER TABLE "parkings" ADD COLUMN IF NOT EXISTS "involved_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[];--> statement-breakpoint
-- Existing parkings were written in solo mode; keep them private so new joiners
-- don't inherit Nader's in-isolation musings. Spec §11 step 5.
UPDATE "parkings" SET "visibility" = 'private' WHERE "visibility" = 'team';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parkings" ADD CONSTRAINT "parkings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parkings_creator_id_idx" ON "parkings" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parkings_target_date_idx" ON "parkings" USING btree ("creator_id", "target_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parkings_status_idx" ON "parkings" USING btree ("creator_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parkings_visibility" ON "parkings" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parkings_involved" ON "parkings" USING gin ("involved_ids");--> statement-breakpoint

-- ─────────────── brands: drop user_id (team-shared) ───────────────
ALTER TABLE "brands" DROP CONSTRAINT IF EXISTS "brands_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "brands_user_id_idx";--> statement-breakpoint
ALTER TABLE "brands" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- ─────────────── brand_stakeholders: drop user_id (team-shared) ───────────────
ALTER TABLE "brand_stakeholders" DROP CONSTRAINT IF EXISTS "brand_stakeholders_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "brand_stakeholders" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- ─────────────── brand_meetings: drop user_id, add attendee_user_ids ───────────────
ALTER TABLE "brand_meetings" DROP CONSTRAINT IF EXISTS "brand_meetings_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "brand_meetings" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "brand_meetings" ADD COLUMN IF NOT EXISTS "attendee_user_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[];--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bm_attendee_users" ON "brand_meetings" USING gin ("attendee_user_ids");--> statement-breakpoint

-- ─────────────── brand_feature_requests: drop user_id (team-shared) ───────────────
ALTER TABLE "brand_feature_requests" DROP CONSTRAINT IF EXISTS "brand_feature_requests_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "brand_feature_requests" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- ─────────────── brand_action_items: rename user_id → creator_id, add assignee_id ───────────────
ALTER TABLE "brand_action_items" DROP CONSTRAINT IF EXISTS "brand_action_items_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "brand_action_items" RENAME COLUMN "user_id" TO "creator_id";--> statement-breakpoint
ALTER TABLE "brand_action_items" ADD COLUMN IF NOT EXISTS "assignee_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_action_items" ADD CONSTRAINT "brand_action_items_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_action_items" ADD CONSTRAINT "brand_action_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bai_assignee" ON "brand_action_items" USING btree ("assignee_id");--> statement-breakpoint

-- ─────────────── brand_events (per-brand activity timeline) ───────────────
CREATE TABLE IF NOT EXISTS "brand_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_events" ADD CONSTRAINT "brand_events_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_events" ADD CONSTRAINT "brand_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_be_brand_created" ON "brand_events" USING btree ("brand_id", "created_at" DESC);--> statement-breakpoint

-- ─────────────── inbox_events (per-recipient notifications) ───────────────
CREATE TABLE IF NOT EXISTS "inbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_events" ADD CONSTRAINT "inbox_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_events" ADD CONSTRAINT "inbox_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ie_user_read" ON "inbox_events" USING btree ("user_id", "read_at", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ie_entity" ON "inbox_events" USING btree ("entity_type", "entity_id");
