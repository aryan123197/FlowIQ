import type { UnifiedCustomer, UnifiedTransaction, TransactionStatus } from '@/types'
import { randomUUID } from 'crypto'

interface ShopifyCustomer {
  id: string; email: string; first_name?: string; last_name?: string
}
interface ShopifyOrder {
  id: string; email?: string; customer_id?: string; total_price: string
  currency: string; financial_status: string; created_at: string
}

const STATUS_MAP: Record<string, TransactionStatus> = {
  paid: 'completed', refunded: 'refunded', pending: 'pending',
  voided: 'cancelled', partially_refunded: 'refunded',
}

export function shopifyCustomerToUnified(raw: ShopifyCustomer): UnifiedCustomer {
  return {
    id: randomUUID(),
    email: raw.email,
    name: [raw.first_name, raw.last_name].filter(Boolean).join(' ') || null,
    shopifyId: String(raw.id),
  }
}

export function shopifyOrderToUnified(raw: ShopifyOrder): UnifiedTransaction {
  return {
    id: randomUUID(),
    customerId: null,
    customerEmail: raw.email ?? null,
    amount: Math.round(parseFloat(raw.total_price) * 100),
    currency: raw.currency.toLowerCase(),
    status: STATUS_MAP[raw.financial_status] ?? 'pending',
    sourcePlatform: 'shopify',
    sourceTransactionId: String(raw.id),
    transactionDate: new Date(raw.created_at),
    rawPayload: raw as unknown as Record<string, unknown>,
  }
}
