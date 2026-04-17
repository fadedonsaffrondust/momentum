CREATE TYPE "public"."meeting_source" AS ENUM('manual', 'recording_sync');--> statement-breakpoint
ALTER TABLE "brand_meetings" ADD COLUMN "source" "meeting_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_meetings" ADD COLUMN "external_meeting_id" text;--> statement-breakpoint
ALTER TABLE "brand_meetings" ADD COLUMN "recording_url" text;--> statement-breakpoint
ALTER TABLE "brand_stakeholders" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "sync_config" jsonb;