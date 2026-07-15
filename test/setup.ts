import { beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

const TABLES = sql`
  transactions, customers, sync_jobs, alert_triggers, alert_rules,
  pipeline_outputs, pipeline_steps, pipeline_runs, pipelines, transform_rules,
  csv_uploads
`

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`)
})
