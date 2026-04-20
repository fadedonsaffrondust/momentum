CREATE TYPE "public"."jarvis_message_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jarvis_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jarvis_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "jarvis_message_role" NOT NULL,
	"content" jsonb NOT NULL,
	"intent" text,
	"model" text,
	"latency_ms" integer,
	"token_usage" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jarvis_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jarvis_conversations" ADD CONSTRAINT "jarvis_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jarvis_messages" ADD CONSTRAINT "jarvis_messages_conversation_id_jarvis_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."jarvis_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jarvis_tool_calls" ADD CONSTRAINT "jarvis_tool_calls_message_id_jarvis_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."jarvis_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jarvis_conversations_user_updated" ON "jarvis_conversations" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jarvis_messages_conversation_created" ON "jarvis_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jarvis_tool_calls_message" ON "jarvis_tool_calls" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jarvis_tool_calls_tool_name" ON "jarvis_tool_calls" USING btree ("tool_name","created_at" DESC NULLS LAST);