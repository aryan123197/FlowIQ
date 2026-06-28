import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { sql, and, gte, lte, eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const offset = (page - 1) * limit
  const platform = searchParams.get('platform')
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const conditions = []
  if (platform) conditions.push(eq(transactions.sourcePlatform, platform as 'stripe' | 'shopify' | 'salesforce' | 'csv'))
  if (status) conditions.push(eq(transactions.status, status as 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled'))
  if (dateFrom) conditions.push(gte(transactions.transactionDate, new Date(dateFrom)))
  if (dateTo) conditions.push(lte(transactions.transactionDate, new Date(dateTo)))

  const [rows, [countRow]] = await Promise.all([
    db.select().from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.transactionDate))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ])

  return NextResponse.json({
    transactions: rows,
    pagination: {
      page,
      limit,
      total: Number(countRow?.count ?? 0),
      totalPages: Math.ceil(Number(countRow?.count ?? 0) / limit),
    },
  })
}
