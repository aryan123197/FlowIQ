import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql, and, gte, lte } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const granularity = searchParams.get('granularity') ?? 'day'
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const truncFn = granularity === 'month' ? 'month' : granularity === 'week' ? 'week' : 'day'

  const conditions = [sql`${transactions.status} = 'completed'`]
  if (dateFrom) conditions.push(gte(transactions.transactionDate, new Date(dateFrom)))
  if (dateTo) conditions.push(lte(transactions.transactionDate, new Date(dateTo)))

  const rows = await db
    .select({
      date: sql<string>`DATE_TRUNC('${sql.raw(truncFn)}', ${transactions.transactionDate})::date::text`,
      platform: transactions.sourcePlatform,
      revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)::int`,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(
      sql`DATE_TRUNC('${sql.raw(truncFn)}', ${transactions.transactionDate})`,
      transactions.sourcePlatform
    )
    .orderBy(sql`DATE_TRUNC('${sql.raw(truncFn)}', ${transactions.transactionDate})`)

  // Pivot: group by date, spread platforms as keys
  const byDate = new Map<string, Record<string, number>>()
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, { stripe: 0, shopify: 0, salesforce: 0, csv: 0 })
    byDate.get(row.date)![row.platform] = Number(row.revenue)
  }

  const timeseries = Array.from(byDate.entries()).map(([date, platforms]) => ({
    date,
    ...platforms,
    total: Object.values(platforms).reduce((s, v) => s + v, 0),
  }))

  return NextResponse.json({ timeseries })
}
