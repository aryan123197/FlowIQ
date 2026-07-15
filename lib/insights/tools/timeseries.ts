import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql, and, gte } from 'drizzle-orm'
import type { TimeseriesResult } from '../types'

const MAX_DAYS = 90

export async function getTimeseriesData(days: number = 30): Promise<TimeseriesResult> {
  const cappedDays = Math.min(days, MAX_DAYS)
  const since = new Date()
  since.setDate(since.getDate() - cappedDays)

  const rows = await db
    .select({
      date: sql<string>`DATE(${transactions.transactionDate})::text`,
      platform: transactions.sourcePlatform,
      revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int`,
    })
    .from(transactions)
    .where(and(gte(transactions.transactionDate, since), sql`${transactions.status} = 'completed'`))
    .groupBy(sql`DATE(${transactions.transactionDate})`, transactions.sourcePlatform)
    .orderBy(sql`DATE(${transactions.transactionDate})`)

  return {
    rows: rows.map((r) => ({ date: r.date, platform: r.platform, revenue: Number(r.revenue) })),
    days: cappedDays,
  }
}
