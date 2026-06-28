import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import type { PlatformBreakdownResult } from '../types'

export async function getPlatformBreakdown(): Promise<PlatformBreakdownResult> {
  const rows = await db
    .select({
      platform: transactions.sourcePlatform,
      revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(sql`${transactions.status} = 'completed'`)
    .groupBy(transactions.sourcePlatform)
    .orderBy(sql`SUM(${transactions.amount}) DESC`)

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0)

  const platforms = rows.map(r => ({
    platform: r.platform,
    revenue: Number(r.revenue),
    count: Number(r.count),
    sharePercent: totalRevenue === 0 ? 0 : (Number(r.revenue) / totalRevenue) * 100,
  }))

  return { platforms, totalRevenue }
}
