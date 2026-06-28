import type { Platform, UnifiedCustomer, UnifiedTransaction } from '@/types'
import { stripeCustomerToUnified, stripeChargeToUnified } from './adapters/stripe.adapter'
import { shopifyCustomerToUnified, shopifyOrderToUnified } from './adapters/shopify.adapter'
import { salesforceContactToUnified, salesforceOpportunityToUnified } from './adapters/salesforce.adapter'
import { csvRowToUnifiedTransaction } from './adapters/csv.adapter'

export function normalizeCustomer(
  platform: Platform,
  raw: Record<string, unknown>
): UnifiedCustomer {
  switch (platform) {
    case 'stripe':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return stripeCustomerToUnified(raw as any)
    case 'shopify':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return shopifyCustomerToUnified(raw as any)
    case 'salesforce':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return salesforceContactToUnified(raw as any)
    case 'csv':
      throw new Error('CSV platform does not have customer records')
  }
}

export function normalizeTransaction(
  platform: Platform,
  raw: Record<string, unknown>,
  resolvedCustomerId?: string | null
): UnifiedTransaction {
  switch (platform) {
    case 'stripe':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return stripeChargeToUnified(raw as any)
    case 'shopify':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return shopifyOrderToUnified(raw as any)
    case 'salesforce':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return salesforceOpportunityToUnified(raw as any, resolvedCustomerId)
    case 'csv':
      return csvRowToUnifiedTransaction(raw)
  }
}
