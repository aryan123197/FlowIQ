import { db } from '@/lib/db/client'
import { transactions, customers } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import type { NlSqlSession } from './engine'

const MAX_SNAPSHOT_ROWS = 50_000

export const PG_TABLES = ['transactions', 'customers'] as const
export type PgTableName = (typeof PG_TABLES)[number]

function toRowObjects(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      out[k] = v instanceof Date ? v.toISOString() : v
    }
    return out
  })
}

export async function loadPgTable(session: NlSqlSession, table: PgTableName) {
  if (table === 'transactions') {
    const rows = await db
      .select({
        id: transactions.id,
        customerId: transactions.customerId,
        amount: transactions.amount,
        currency: transactions.currency,
        status: transactions.status,
        sourcePlatform: transactions.sourcePlatform,
        sourceTransactionId: transactions.sourceTransactionId,
        transactionDate: transactions.transactionDate,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .orderBy(desc(transactions.transactionDate))
      .limit(MAX_SNAPSHOT_ROWS)

    return session.loadTable({
      tableName: 'transactions',
      columns: [
        'id',
        'customerId',
        'amount',
        'currency',
        'status',
        'sourcePlatform',
        'sourceTransactionId',
        'transactionDate',
        'createdAt',
      ],
      rows: toRowObjects(rows),
    })
  }

  const rows = await db
    .select({
      id: customers.id,
      email: customers.email,
      name: customers.name,
      stripeId: customers.stripeId,
      shopifyId: customers.shopifyId,
      salesforceId: customers.salesforceId,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
    })
    .from(customers)
    .orderBy(desc(customers.createdAt))
    .limit(MAX_SNAPSHOT_ROWS)

  return session.loadTable({
    tableName: 'customers',
    columns: [
      'id',
      'email',
      'name',
      'stripeId',
      'shopifyId',
      'salesforceId',
      'createdAt',
      'updatedAt',
    ],
    rows: toRowObjects(rows),
  })
}
