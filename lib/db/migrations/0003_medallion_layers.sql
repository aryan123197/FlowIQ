-- Bronze layer: raw event store (pre-normalization)
CREATE TABLE IF NOT EXISTS "bronze_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sync_job_id" uuid NOT NULL REFERENCES "sync_jobs"("id") ON DELETE CASCADE,
  "platform" "platform" NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "source_id" varchar(255),
  "payload" jsonb NOT NULL,
  "ingested_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uniq_bronze_platform_source" UNIQUE("platform", "source_id")
);

-- Gold layer: pre-aggregated daily metrics
CREATE TABLE IF NOT EXISTS "gold_metrics_daily" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "date" varchar(10) NOT NULL,
  "platform" "platform" NOT NULL,
  "total_revenue" integer DEFAULT 0 NOT NULL,
  "transaction_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "refreshed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uniq_gold_date_platform" UNIQUE("date", "platform")
);
