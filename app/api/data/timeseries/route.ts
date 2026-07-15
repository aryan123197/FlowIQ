import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { goldMetricsDaily } from '@/lib/db/schema'
import { sql, and, gte, lte } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const granularity = searchParams.get('granularity') ?? 'day'
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const truncFn = granularity === 'month' ? 'month' : granularity === 'week' ? 'week' : 'day'

  const conditions = []
  if (dateFrom) conditions.push(gte(goldMetricsDaily.date, dateFrom))
  if (dateTo) conditions.push(lte(goldMetricsDaily.date, dateTo))

  // Roll up gold rows to the requested granularity
  const rows = await db
    .select({
      date: sql<string>`DATE_TRUNC('${sql.raw(truncFn)}', ${goldMetricsDaily.date}::date)::date::text`,
      platform: goldMetricsDaily.platform,
      revenue: sql<number>`SUM(${goldMetricsDaily.totalRevenue})::int`,
    })
    .from(goldMetricsDaily)
    .where(and(...conditions))
    .groupBy(
      sql`DATE_TRUNC('${sql.raw(truncFn)}', ${goldMetricsDaily.date}::date)`,
      goldMetricsDaily.platform
    )
    .orderBy(sql`DATE_TRUNC('${sql.raw(truncFn)}', ${goldMetricsDaily.date}::date)`)

  // Pivot: group by date, spread platforms as keys
  const byDate = new Map<string, Record<string, number>>()
  for (const row of rows) {
    if (!byDate.has(row.date))
      byDate.set(row.date, { stripe: 0, shopify: 0, salesforce: 0, csv: 0 })
    byDate.get(row.date)![row.platform] = Number(row.revenue)
  }

  const timeseries = Array.from(byDate.entries()).map(([date, platforms]) => ({
    date,
    ...platforms,
    total: Object.values(platforms).reduce((s, v) => s + v, 0),
  }))

  return NextResponse.json({ timeseries })
}
