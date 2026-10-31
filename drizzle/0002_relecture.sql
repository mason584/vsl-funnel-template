ALTER TABLE "leads" ADD COLUMN "review_verdict" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "review_source" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reviewed_at" timestamp with time zone;