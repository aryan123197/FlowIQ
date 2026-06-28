import { db } from '@/lib/db/client'
import { transactions, customers } from '@/lib/db/schema'
import { sql, and, gte } from 'drizzle-orm'
import type { AlertRule } from '@/lib/db/schema'

export function parseTimeWindow(timeWindow: string): number {
  const match = timeWindow.match(/^(\d+)([hd])$/)
  if (!match) throw new Error(`Invalid time window: ${timeWindow}`)
  const [, amount, unit] = match
  const hours = unit === 'd' ? Number(amount) * 24 : Number(amount)
  return hours
}

export async function calculateMetric(metric: AlertRule['metric'], timeWindow: string): Promise<number> {
  const windowStart = new Date()
  windowStart.setHours(windowStart.getHours() - parseTimeWindow(timeWindow))

  switch (metric) {
    case 'revenue_total': {
      const [row] = await db
        .select({ value: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int` })
        .from(transactions)
        .where(
          and(
            gte(transactions.transactionDate, windowStart),
            sql`${transactions.status} = 'completed'`
          )
        )
      return Number(row?.value ?? 0)
    }

    case 'transaction_count': {
      const [row] = await db
        .select({ value: sql<number>`COUNT(*)::int` })
        .from(transactions)
        .where(gte(transactions.transactionDate, windowStart))
      return Number(row?.value ?? 0)
    }

    case 'failed_transaction_rate': {
      const [row] = await db
        .select({
          total: sql<number>`COUNT(*)::int`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${transactions.status} = 'failed')::int`,
        })
        .from(transactions)
        .where(gte(transactions.transactionDate, windowStart))
      const total = Number(row?.total ?? 0)
      const failed = Number(row?.failed ?? 0)
      return total === 0 ? 0 : failed / total
    }

    case 'customer_count': {
      const [row] = await db
        .select({ value: sql<number>`COUNT(*)::int` })
        .from(customers)
        .where(gte(customers.createdAt, windowStart))
      return Number(row?.value ?? 0)
    }
  }
}
