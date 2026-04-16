CREATE TYPE "public"."parking_status" AS ENUM('open', 'discussed', 'archived');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parkings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"outcome" text,
	"target_date" date,
	"role_id" uuid,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"status" "parking_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discussed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parkings" ADD CONSTRAINT "parkings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parkings" ADD CONSTRAINT "parkings_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parkings_user_id_idx" ON "parkings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parkings_target_date_idx" ON "parkings" USING btree ("user_id","target_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parkings_status_idx" ON "parkings" USING btree ("user_id","status");