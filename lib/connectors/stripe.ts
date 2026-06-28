import Stripe from 'stripe'
import { BaseConnector, type RawCustomer, type RawTransaction } from './base'

const BATCH_SIZE = 100

export class StripeConnector extends BaseConnector {
  readonly platform = 'stripe' as const
  private client: Stripe

  constructor(apiKey: string) {
    super()
    this.client = new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' })
  }

  async validate(): Promise<void> {
    await this.client.balance.retrieve()
  }

  async *fetchCustomers(): AsyncGenerator<RawCustomer[]> {
    let batch: RawCustomer[] = []
    for await (const customer of this.client.customers.list({ limit: BATCH_SIZE })) {
      batch.push(customer as RawCustomer)
      if (batch.length >= BATCH_SIZE) {
        yield batch
        batch = []
      }
    }
    if (batch.length > 0) yield batch
  }

  async *fetchTransactions(): AsyncGenerator<RawTransaction[]> {
    let batch: RawTransaction[] = []
    for await (const charge of this.client.charges.list({ limit: BATCH_SIZE, expand: ['data.customer'] })) {
      batch.push(charge as RawTransaction)
      if (batch.length >= BATCH_SIZE) {
        yield batch
        batch = []
      }
    }
    if (batch.length > 0) yield batch
  }
}
