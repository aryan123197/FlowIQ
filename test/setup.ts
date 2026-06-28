import { beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE
    transactions, customers, sync_jobs, alert_triggers, alert_rules
    RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE
    transactions, customers, sync_jobs, alert_triggers, alert_rules
    RESTART IDENTITY CASCADE`)
})
