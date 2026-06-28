import type Stripe from 'stripe'
import type { UnifiedCustomer, UnifiedTransaction, TransactionStatus } from '@/types'
import { randomUUID } from 'crypto'

const STATUS_MAP: Record<string, TransactionStatus> = {
  succeeded: 'completed',
  failed: 'failed',
  pending: 'pending',
  refunded: 'refunded',
}

export function stripeCustomerToUnified(raw: Stripe.Customer): UnifiedCustomer {
  return {
    id: randomUUID(),
    email: raw.email ?? '',
    name: raw.name ?? null,
    stripeId: raw.id,
    attributes: {
      phone: raw.phone ?? null,
      metadata: raw.metadata,
    },
  }
}

export function stripeChargeToUnified(raw: Stripe.Charge): UnifiedTransaction {
  const customer = raw.customer as Stripe.Customer | null
  return {
    id: randomUUID(),
    customerId: null,
    customerEmail: raw.billing_details?.email ?? (customer?.email ?? null),
    amount: raw.amount,
    currency: raw.currency.toLowerCase(),
    status: STATUS_MAP[raw.status] ?? 'pending',
    sourcePlatform: 'stripe',
    sourceTransactionId: raw.id,
    transactionDate: new Date(raw.created * 1000),
    rawPayload: raw as unknown as Record<string, unknown>,
  }
}
