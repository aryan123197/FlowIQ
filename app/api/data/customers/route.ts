import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { customers } from '@/lib/db/schema'
import { sql, or, ilike, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const offset = (page - 1) * limit
  const search = searchParams.get('search')

  const condition = search
    ? or(
        ilike(customers.email, `%${search}%`),
        ilike(customers.name, `%${search}%`)
      )
    : undefined

  const [rows, [countRow]] = await Promise.all([
    db.select().from(customers)
      .where(condition)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(customers)
      .where(condition),
  ])

  return NextResponse.json({
    customers: rows,
    pagination: {
      page,
      limit,
      total: Number(countRow?.count ?? 0),
      totalPages: Math.ceil(Number(countRow?.count ?? 0) / limit),
    },
  })
}
