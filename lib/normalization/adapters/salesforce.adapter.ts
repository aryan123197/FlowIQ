import { randomUUID } from 'crypto'
import type { UnifiedCustomer, UnifiedTransaction } from '@/types'

interface SalesforceContact {
  Id: string
  Email: string
  Name: string
  AccountId?: string
  CreatedDate?: string
}

interface SalesforceOpportunity {
  Id: string
  ContactId?: string
  ContactEmail?: string
  Name: string
  Amount: number
  StageName: string
  CloseDate: string
  CurrencyIsoCode?: string
}

export function salesforceContactToUnified(raw: SalesforceContact): UnifiedCustomer {
  return {
    id: randomUUID(),
    email: raw.Email,
    name: raw.Name,
    salesforceId: raw.Id,
    attributes: {
      accountId: raw.AccountId ?? null,
      createdDate: raw.CreatedDate ?? null,
    },
  }
}

export function salesforceOpportunityToUnified(
  raw: SalesforceOpportunity,
  resolvedCustomerId?: string | null
): UnifiedTransaction {
  return {
    id: randomUUID(),
    customerId: resolvedCustomerId ?? null,
    customerEmail: raw.ContactEmail ?? null,
    amount: Math.round(raw.Amount * 100),
    currency: (raw.CurrencyIsoCode ?? 'USD').toLowerCase(),
    status: 'completed',
    sourcePlatform: 'salesforce',
    sourceTransactionId: raw.Id,
    transactionDate: new Date(raw.CloseDate),
    rawPayload: raw as unknown as Record<string, unknown>,
  }
}
