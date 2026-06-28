import { db } from '@/lib/db/client'
import { transactions, customers } from '@/lib/db/schema'
import { sql, eq } from 'drizzle-orm'
import type { TopCustomersResult } from '../types'

export async function getTopCustomers(limit: number = 5): Promise<TopCustomersResult> {
  const rows = await db
    .select({
      customerId: transactions.customerId,
      revenue: sql<number>`SUM(${transactions.amount})::int`,
    })
    .from(transactions)
    .where(sql`${transactions.status} = 'completed' AND ${transactions.customerId} IS NOT NULL`)
    .groupBy(transactions.customerId)
    .orderBy(sql`SUM(${transactions.amount}) DESC`)
    .limit(limit)

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0)

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const [customer] = await db
        .select({ email: customers.email, name: customers.name })
        .from(customers)
        .where(eq(customers.id, r.customerId!))
        .limit(1)
      return {
        email: customer?.email ?? 'unknown',
        name: customer?.name ?? null,
        revenue: Number(r.revenue),
        sharePercent: totalRevenue === 0 ? 0 : (Number(r.revenue) / totalRevenue) * 100,
      }
    })
  )

  return { customers: enriched, totalRevenue }
}
