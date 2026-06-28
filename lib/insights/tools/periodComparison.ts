import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql, and, gte, lt } from 'drizzle-orm'
import type { PeriodComparisonResult } from '../types'

export async function getPeriodComparison(period: 'week' | 'month' = 'month'): Promise<PeriodComparisonResult> {
  const now = new Date()
  const days = period === 'week' ? 7 : 30

  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - days)

  const priorStart = new Date(currentStart)
  priorStart.setDate(priorStart.getDate() - days)

  const [currentRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int` })
    .from(transactions)
    .where(and(gte(transactions.transactionDate, currentStart), sql`${transactions.status} = 'completed'`))

  const [priorRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int` })
    .from(transactions)
    .where(and(
      gte(transactions.transactionDate, priorStart),
      lt(transactions.transactionDate, currentStart),
      sql`${transactions.status} = 'completed'`
    ))

  const current = Number(currentRow?.total ?? 0)
  const prior = Number(priorRow?.total ?? 0)
  const deltaPercent = prior === 0 ? 0 : ((current - prior) / prior) * 100

  return { current, prior, deltaPercent, period }
}
