CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone_number" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"step_reached" text,
	"status" text DEFAULT 'partial' NOT NULL,
	"disqualified_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"iclosed_contact_id" text,
	"iclosed_booking_id" text,
	"iclosed_error" text,
	"slot_iso" text,
	"meta_event_sent_at" timestamp with time zone,
	"meta_event_detail" text,
	"meta_touch" text,
	"landing_url" text,
	"utm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fbc" text,
	"fbp" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"landing_url" text,
	"utm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"country" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "leads_session_idx" ON "leads" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "visits_created_idx" ON "visits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "visits_path_idx" ON "visits" USING btree ("path","created_at");--> statement-breakpoint
CREATE INDEX "visits_session_idx" ON "visits" USING btree ("session_id");