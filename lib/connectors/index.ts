import { StripeConnector } from './stripe'
import { CSVConnector } from './csv'
import { ShopifyMockConnector } from './shopify.mock'
import { SalesforceMockConnector } from './salesforce.mock'
import type { BaseConnector } from './base'
import type { Platform } from '@/types'

export function createConnector(platform: Platform, config: Record<string, unknown> = {}): BaseConnector {
  switch (platform) {
    case 'stripe':
      return new StripeConnector(
        (config.apiKey as string | undefined) ?? process.env.STRIPE_SECRET_KEY ?? ''
      )
    case 'shopify':
      return new ShopifyMockConnector()
    case 'salesforce':
      return new SalesforceMockConnector()
    case 'csv':
      return new CSVConnector((config.content as string | undefined) ?? '')
    default:
      throw new Error(`Unknown platform: ${platform}`)
  }
}
