CREATE TABLE "csv_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_job_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"sample_rows" jsonb DEFAULT '[]'::jsonb,
	"sample_error_rows" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_uploads" ADD CONSTRAINT "csv_uploads_sync_job_id_sync_jobs_id_fk" FOREIGN KEY ("sync_job_id") REFERENCES "public"."sync_jobs"("id") ON DELETE cascade ON UPDATE no action;