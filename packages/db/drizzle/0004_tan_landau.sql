CREATE TYPE "public"."feature_request_sync_status" AS ENUM('synced', 'pending', 'error');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_feature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sheet_row_index" integer,
	"date" text NOT NULL,
	"request" text NOT NULL,
	"response" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"sync_status" "feature_request_sync_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "feature_requests_config" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_feature_requests" ADD CONSTRAINT "brand_feature_requests_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_feature_requests" ADD CONSTRAINT "brand_feature_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_feature_requests_brand_id_idx" ON "brand_feature_requests" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_feature_requests_sync_status_idx" ON "brand_feature_requests" USING btree ("brand_id","sync_status");