import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { transactions, customers } from '@/lib/db/schema'
import { sql, and, gte, lte } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const conditions = [sql`${transactions.status} = 'completed'`]
  if (dateFrom) conditions.push(gte(transactions.transactionDate, new Date(dateFrom)))
  if (dateTo) conditions.push(lte(transactions.transactionDate, new Date(dateTo)))

  const [txMetrics] = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int`,
      transactionCount: sql<number>`COUNT(*)::int`,
      avgTransactionValue: sql<number>`COALESCE(AVG(${transactions.amount}), 0)::int`,
    })
    .from(transactions)
    .where(and(...conditions))

  const [totalAllStatuses] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(
      and(
        dateFrom ? gte(transactions.transactionDate, new Date(dateFrom)) : undefined,
        dateTo ? lte(transactions.transactionDate, new Date(dateTo)) : undefined,
      )
    )

  const [failedOnly] = await db
    .select({ failed: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(
      and(
        sql`${transactions.status} = 'failed'`,
        dateFrom ? gte(transactions.transactionDate, new Date(dateFrom)) : undefined,
        dateTo ? lte(transactions.transactionDate, new Date(dateTo)) : undefined,
      )
    )

  const [customerMetrics] = await db
    .select({ customerCount: sql<number>`COUNT(*)::int` })
    .from(customers)

  const platformRows = await db
    .select({
      platform: transactions.sourcePlatform,
      revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.sourcePlatform)

  const totalTxns = Number(totalAllStatuses?.total ?? 0)
  const failedTxns = Number(failedOnly?.failed ?? 0)

  return NextResponse.json({
    totalRevenue: Number(txMetrics?.totalRevenue ?? 0),
    transactionCount: Number(txMetrics?.transactionCount ?? 0),
    avgTransactionValue: Number(txMetrics?.avgTransactionValue ?? 0),
    customerCount: Number(customerMetrics?.customerCount ?? 0),
    failedTransactionRate: totalTxns === 0 ? 0 : failedTxns / totalTxns,
    platformBreakdown: platformRows.map(r => ({
      platform: r.platform,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })),
  })
}
