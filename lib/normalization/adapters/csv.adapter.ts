import { randomUUID } from 'crypto'
import type { UnifiedTransaction, TransactionStatus } from '@/types'

export function csvRowToUnifiedTransaction(row: Record<string, unknown>): UnifiedTransaction {
  return {
    id: randomUUID(),
    customerId: null,
    customerEmail: (row.email as string | undefined) ?? null,
    amount: row.amount as number,
    currency: ((row.currency as string | undefined) ?? 'usd').toLowerCase(),
    status: (row.status as TransactionStatus) ?? 'completed',
    sourcePlatform: 'csv',
    sourceTransactionId: row.id as string,
    transactionDate: new Date(row.date as string),
    rawPayload: row,
  }
}
