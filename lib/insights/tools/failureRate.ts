import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql, and, gte } from 'drizzle-orm'
import type { FailureRateResult } from '../types'

export async function getFailureRate(windowHours: number = 24): Promise<FailureRateResult> {
  const windowStart = new Date()
  windowStart.setHours(windowStart.getHours() - windowHours)

  const rollingStart = new Date()
  rollingStart.setDate(rollingStart.getDate() - 7)

  const [windowRow] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${transactions.status} = 'failed')::int`,
    })
    .from(transactions)
    .where(gte(transactions.transactionDate, windowStart))

  const [rollingRow] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${transactions.status} = 'failed')::int`,
    })
    .from(transactions)
    .where(gte(transactions.transactionDate, rollingStart))

  const currentRate = Number(windowRow?.total ?? 0) === 0 ? 0 : Number(windowRow?.failed ?? 0) / Number(windowRow?.total ?? 1)
  const rollingAvgRate = Number(rollingRow?.total ?? 0) === 0 ? 0 : Number(rollingRow?.failed ?? 0) / Number(rollingRow?.total ?? 1)
  const ratio = rollingAvgRate === 0 ? 1 : currentRate / rollingAvgRate

  return { currentRate, rollingAvgRate, ratio, windowHours }
}
