import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql, and, gte } from 'drizzle-orm'
import type { RevenueTrendResult } from '../types'

export async function getRevenueTrend(days: number = 30): Promise<RevenueTrendResult> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const rows = await db
    .select({
      date: sql<string>`DATE(${transactions.transactionDate})::text`,
      revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.transactionDate, since),
        sql`${transactions.status} = 'completed'`
      )
    )
    .groupBy(sql`DATE(${transactions.transactionDate})`)
    .orderBy(sql`DATE(${transactions.transactionDate})`)

  const buckets = rows.map(r => ({ date: r.date, revenue: Number(r.revenue) }))

  if (buckets.length < 2) {
    return { buckets, slope: 0, percentChange: 0, totalRevenue: buckets.reduce((s, b) => s + b.revenue, 0) }
  }

  // Linear regression (least squares)
  const n = buckets.length
  const xMean = (n - 1) / 2
  const yMean = buckets.reduce((s, b) => s + b.revenue, 0) / n
  let num = 0, den = 0
  buckets.forEach((b, i) => {
    num += (i - xMean) * (b.revenue - yMean)
    den += (i - xMean) ** 2
  })
  const slope = den === 0 ? 0 : num / den

  const first = buckets[0].revenue
  const last = buckets[buckets.length - 1].revenue
  const percentChange = first === 0 ? 0 : ((last - first) / first) * 100

  const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0)

  return { buckets, slope, percentChange, totalRevenue }
}
