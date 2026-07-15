import { db } from '@/lib/db/client'
import { goldMetricsDaily, transactions } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

// Recomputes gold_metrics_daily from silver (transactions table) for every
// date+platform combination that has data. Called at the end of every sync.
export async function refreshGold(): Promise<void> {
  const rows = await db
    .select({
      date: sql<string>`DATE_TRUNC('day', ${transactions.transactionDate})::date::text`,
      platform: transactions.sourcePlatform,
      totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} ELSE 0 END), 0)::int`,
      transactionCount: sql<number>`COUNT(*)::int`,
      failedCount: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.status} = 'failed' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(transactions)
    .groupBy(sql`DATE_TRUNC('day', ${transactions.transactionDate})`, transactions.sourcePlatform)

  if (rows.length === 0) return

  await db
    .insert(goldMetricsDaily)
    .values(
      rows.map((r) => ({
        date: r.date,
        platform: r.platform,
        totalRevenue: Number(r.totalRevenue),
        transactionCount: Number(r.transactionCount),
        failedCount: Number(r.failedCount),
        refreshedAt: new Date(),
      }))
    )
    .onConflictDoUpdate({
      target: [goldMetricsDaily.date, goldMetricsDaily.platform],
      set: {
        totalRevenue: sql`excluded.total_revenue`,
        transactionCount: sql`excluded.transaction_count`,
        failedCount: sql`excluded.failed_count`,
        refreshedAt: sql`now()`,
      },
    })
}
