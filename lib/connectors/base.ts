import type { Platform, UnifiedCustomer, UnifiedTransaction } from '@/types'

export interface RawCustomer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface RawTransaction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export abstract class BaseConnector {
  abstract readonly platform: Platform

  abstract validate(): Promise<void>

  abstract fetchCustomers(): AsyncGenerator<RawCustomer[]>

  abstract fetchTransactions(): AsyncGenerator<RawTransaction[]>
}

export type { UnifiedCustomer, UnifiedTransaction }
