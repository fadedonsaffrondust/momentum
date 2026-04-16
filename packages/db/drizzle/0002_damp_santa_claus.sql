CREATE TYPE "public"."brand_action_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."brand_status" AS ENUM('active', 'importing', 'import_failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"meeting_id" uuid,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" "brand_action_status" DEFAULT 'open' NOT NULL,
	"owner" text,
	"due_date" date,
	"linked_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"attendees" text[] DEFAULT '{}'::text[] NOT NULL,
	"summary" text,
	"raw_notes" text DEFAULT '' NOT NULL,
	"decisions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_stakeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goals" text,
	"success_definition" text,
	"custom_fields" jsonb DEFAULT '{}' NOT NULL,
	"status" "brand_status" DEFAULT 'active' NOT NULL,
	"import_error" text,
	"imported_from" text,
	"raw_import_content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_action_items" ADD CONSTRAINT "brand_action_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_action_items" ADD CONSTRAINT "brand_action_items_meeting_id_brand_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."brand_meetings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_action_items" ADD CONSTRAINT "brand_action_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_action_items" ADD CONSTRAINT "brand_action_items_linked_task_id_tasks_id_fk" FOREIGN KEY ("linked_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_meetings" ADD CONSTRAINT "brand_meetings_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_meetings" ADD CONSTRAINT "brand_meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_stakeholders" ADD CONSTRAINT "brand_stakeholders_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_stakeholders" ADD CONSTRAINT "brand_stakeholders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brands" ADD CONSTRAINT "brands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_action_items_brand_id_idx" ON "brand_action_items" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_action_items_status_idx" ON "brand_action_items" USING btree ("brand_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_meetings_brand_id_idx" ON "brand_meetings" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_meetings_date_idx" ON "brand_meetings" USING btree ("brand_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_stakeholders_brand_id_idx" ON "brand_stakeholders" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brands_user_id_idx" ON "brands" USING btree ("user_id");