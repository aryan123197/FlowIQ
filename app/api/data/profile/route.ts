import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { transactions, customers } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  const [txProfile] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      withCustomer: sql<number>`COUNT(${transactions.customerId})::int`,
      minAmount: sql<number>`MIN(${transactions.amount})::int`,
      maxAmount: sql<number>`MAX(${transactions.amount})::int`,
      avgAmount: sql<number>`AVG(${transactions.amount})::int`,
      currencies: sql<number>`COUNT(DISTINCT ${transactions.currency})::int`,
      platforms: sql<number>`COUNT(DISTINCT ${transactions.sourcePlatform})::int`,
    })
    .from(transactions)

  const statusRows = await db
    .select({
      status: transactions.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .groupBy(transactions.status)

  const platformRows = await db
    .select({
      platform: transactions.sourcePlatform,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .groupBy(transactions.sourcePlatform)

  const [custProfile] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      withStripe: sql<number>`COUNT(${customers.stripeId})::int`,
      withShopify: sql<number>`COUNT(${customers.shopifyId})::int`,
      withSalesforce: sql<number>`COUNT(${customers.salesforceId})::int`,
    })
    .from(customers)

  const total = Number(txProfile?.total ?? 0)

  return NextResponse.json({
    transactions: {
      total,
      nullCustomerRate: total === 0 ? 0 : 1 - Number(txProfile?.withCustomer ?? 0) / total,
      amountRange: {
        min: Number(txProfile?.minAmount ?? 0),
        max: Number(txProfile?.maxAmount ?? 0),
        avg: Number(txProfile?.avgAmount ?? 0),
      },
      distinctCurrencies: Number(txProfile?.currencies ?? 0),
      distinctPlatforms: Number(txProfile?.platforms ?? 0),
      byStatus: statusRows.map(r => ({ status: r.status, count: Number(r.count) })),
      byPlatform: platformRows.map(r => ({ platform: r.platform, count: Number(r.count) })),
    },
    customers: {
      total: Number(custProfile?.total ?? 0),
      byPlatform: {
        stripe: Number(custProfile?.withStripe ?? 0),
        shopify: Number(custProfile?.withShopify ?? 0),
        salesforce: Number(custProfile?.withSalesforce ?? 0),
      },
    },
  })
}
