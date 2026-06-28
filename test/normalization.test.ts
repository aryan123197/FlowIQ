import { describe, it, expect } from 'vitest'
import { stripeCustomerToUnified, stripeChargeToUnified } from '@/lib/normalization/adapters/stripe.adapter'
import { shopifyCustomerToUnified, shopifyOrderToUnified } from '@/lib/normalization/adapters/shopify.adapter'
import { salesforceContactToUnified, salesforceOpportunityToUnified } from '@/lib/normalization/adapters/salesforce.adapter'
import { csvRowToUnifiedTransaction } from '@/lib/normalization/adapters/csv.adapter'
import type Stripe from 'stripe'

describe('stripe adapter', () => {
  it('normalizes a customer', () => {
    const raw = { id: 'cus_123', email: 'a@b.com', name: 'Alice', phone: '555-1234', metadata: { tier: 'gold' } } as unknown as Stripe.Customer
    const c = stripeCustomerToUnified(raw)
    expect(c.email).toBe('a@b.com')
    expect(c.stripeId).toBe('cus_123')
    expect(c.attributes).toEqual({ phone: '555-1234', metadata: { tier: 'gold' } })
  })

  it('normalizes a charge with amount already in cents', () => {
    const raw = {
      id: 'ch_123', amount: 1999, currency: 'USD', status: 'succeeded',
      created: 1700000000, billing_details: { email: 'a@b.com' }, customer: null,
    } as unknown as Stripe.Charge
    const t = stripeChargeToUnified(raw)
    expect(t.amount).toBe(1999)
    expect(t.currency).toBe('usd')
    expect(t.status).toBe('completed')
    expect(t.sourcePlatform).toBe('stripe')
    expect(t.transactionDate.getTime()).toBe(1700000000 * 1000)
  })

  it('maps unknown stripe status to pending', () => {
    const raw = { id: 'ch_1', amount: 100, currency: 'usd', status: 'weird_status', created: 0, billing_details: {} } as unknown as Stripe.Charge
    expect(stripeChargeToUnified(raw).status).toBe('pending')
  })
})

describe('shopify adapter', () => {
  it('normalizes a customer, joining first/last name', () => {
    const c = shopifyCustomerToUnified({ id: '1', email: 'e@e.com', first_name: 'Emma', last_name: 'Watson' })
    expect(c.name).toBe('Emma Watson')
    expect(c.shopifyId).toBe('1')
  })

  it('converts total_price string dollars to integer cents', () => {
    const t = shopifyOrderToUnified({
      id: '1', email: 'e@e.com', total_price: '149.99', currency: 'USD',
      financial_status: 'paid', created_at: '2024-06-01T10:30:00Z',
    })
    expect(t.amount).toBe(14999)
    expect(t.currency).toBe('usd')
    expect(t.status).toBe('completed')
  })

  it.each([
    ['paid', 'completed'],
    ['refunded', 'refunded'],
    ['pending', 'pending'],
    ['voided', 'cancelled'],
    ['partially_refunded', 'refunded'],
  ])('maps financial_status %s to %s', (financial_status, expected) => {
    const t = shopifyOrderToUnified({
      id: '1', total_price: '10.00', currency: 'USD', financial_status, created_at: '2024-01-01',
    })
    expect(t.status).toBe(expected)
  })
})

describe('salesforce adapter', () => {
  it('normalizes a contact', () => {
    const c = salesforceContactToUnified({ Id: 'sf1', Email: 'n@acme.com', Name: 'Noah', AccountId: 'acc1' })
    expect(c.email).toBe('n@acme.com')
    expect(c.salesforceId).toBe('sf1')
    expect(c.attributes).toEqual({ accountId: 'acc1', createdDate: null })
  })

  it('converts dollar Amount to integer cents and lowercases currency', () => {
    const t = salesforceOpportunityToUnified({
      Id: 'opp1', ContactEmail: 'n@acme.com', Name: 'Deal', Amount: 12500.00,
      StageName: 'Closed Won', CloseDate: '2024-05-30', CurrencyIsoCode: 'USD',
    })
    expect(t.amount).toBe(1250000)
    expect(t.currency).toBe('usd')
    expect(t.status).toBe('completed')
  })

  it('defaults currency to usd when CurrencyIsoCode is missing', () => {
    const t = salesforceOpportunityToUnified({
      Id: 'opp1', Name: 'Deal', Amount: 10, StageName: 'Closed Won', CloseDate: '2024-01-01',
    })
    expect(t.currency).toBe('usd')
  })
})

describe('csv adapter', () => {
  it('passes through amount as-is (already integer cents) and lowercases currency', () => {
    const t = csvRowToUnifiedTransaction({ id: 'row1', email: 'x@x.com', amount: 5000, currency: 'EUR', status: 'completed', date: '2024-01-01' })
    expect(t.amount).toBe(5000)
    expect(t.currency).toBe('eur')
    expect(t.sourcePlatform).toBe('csv')
  })

  it('defaults status to completed and currency to usd when absent', () => {
    const t = csvRowToUnifiedTransaction({ id: 'row1', amount: 100, date: '2024-01-01' })
    expect(t.status).toBe('completed')
    expect(t.currency).toBe('usd')
  })
})
