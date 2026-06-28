import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql, and, gte } from 'drizzle-orm'
import type { AnomalyResult } from '../types'

export async function getAnomalies(sensitivitySigma: number = 2.0): Promise<AnomalyResult> {
  const since = new Date()
  since.setDate(since.getDate() - 60)

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

  if (rows.length < 3) return { anomalyDays: [], mean: 0, stdDev: 0 }

  const revenues = rows.map(r => Number(r.revenue))
  const mean = revenues.reduce((s, v) => s + v, 0) / revenues.length
  const variance = revenues.reduce((s, v) => s + (v - mean) ** 2, 0) / revenues.length
  const stdDev = Math.sqrt(variance)

  const anomalyDays = rows
    .map((r, i) => ({ date: r.date, revenue: revenues[i], zScore: stdDev === 0 ? 0 : (revenues[i] - mean) / stdDev }))
    .filter(r => Math.abs(r.zScore) >= sensitivitySigma)

  return { anomalyDays, mean, stdDev }
}
