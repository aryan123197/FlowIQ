import { db } from './client'
import { syncJobs, customers, transactions, alertRules } from './schema'
import { eq, sql } from 'drizzle-orm'
import { runSync } from '@/lib/engine/syncOrchestrator'
import { StripeMockConnector } from '@/lib/connectors/stripe.mock'
import {
  stripeCustomerToUnified,
  stripeChargeToUnified,
} from '@/lib/normalization/adapters/stripe.adapter'
import type Stripe from 'stripe'

const SAMPLE_CSV = `email,amount,currency,status,date,id
noah.parker@example.com,75.00,usd,completed,2024-07-01,csv_txn_001
ava.thompson@example.com,129.99,usd,completed,2024-07-03,csv_txn_002
noah.parker@example.com,32.00,usd,pending,2024-07-10,csv_txn_003
liam.foster@example.com,56.00,usd,failed,2024-07-12,csv_txn_004
ava.thompson@example.com,98.00,usd,completed,2024-07-18,csv_txn_005
`

async function seedStripe(): Promise<void> {
  const connector = new StripeMockConnector()

  for await (const batch of connector.fetchCustomers()) {
    for (const raw of batch) {
      const unified = stripeCustomerToUnified(raw as unknown as Stripe.Customer)
      await db
        .insert(customers)
        .values({
          email: unified.email,
          name: unified.name ?? null,
          stripeId: unified.stripeId ?? null,
          attributes: unified.attributes ?? {},
        })
        .onConflictDoUpdate({
          target: customers.email,
          set: { stripeId: unified.stripeId ?? null, updatedAt: new Date() },
        })
    }
  }

  for await (const batch of connector.fetchTransactions()) {
    for (const raw of batch) {
      const unified = stripeChargeToUnified(raw as unknown as Stripe.Charge)
      const [customer] = unified.customerEmail
        ? await db
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.email, unified.customerEmail))
            .limit(1)
        : []

      await db
        .insert(transactions)
        .values({
          customerId: customer?.id ?? null,
          sourcePlatform: 'stripe',
          sourceTransactionId: unified.sourceTransactionId,
          amount: unified.amount,
          currency: unified.currency,
          status: unified.status,
          transactionDate: unified.transactionDate,
          rawPayload: unified.rawPayload ?? {},
        })
        .onConflictDoNothing()
    }
  }
}

async function seedViaOrchestrator(
  platform: 'shopify' | 'salesforce' | 'csv',
  csvContent?: string
): Promise<void> {
  const [job] = await db
    .insert(syncJobs)
    .values({ sourcePlatform: platform, status: 'pending' })
    .returning()
  await runSync(
    job.id,
    platform,
    csvContent ? { csvContent, filename: 'seed-sample.csv' } : undefined
  )
}

async function seedAlertRules(): Promise<void> {
  await db.insert(alertRules).values([
    {
      name: 'High failed transaction rate',
      metric: 'failed_transaction_rate',
      threshold: '0.10',
      comparisonOperator: 'gt',
      timeWindow: '24h',
      actionType: 'email',
      actionConfig: { to: 'alerts@enterprise-platform.local' },
      enabled: true,
    },
    {
      name: 'Daily revenue floor',
      metric: 'revenue_total',
      threshold: '100.00',
      comparisonOperator: 'lt',
      timeWindow: '24h',
      actionType: 'slack',
      actionConfig: { webhookUrl: 'https://hooks.slack.com/services/placeholder' },
      enabled: false,
    },
  ])
}

async function main(): Promise<void> {
  console.log('Seeding database...')

  await db.execute(
    sql`TRUNCATE TABLE transactions, customers, sync_jobs, alert_triggers, alert_rules, pipeline_outputs, pipeline_steps, pipeline_runs, pipelines, transform_rules, csv_uploads RESTART IDENTITY CASCADE`
  )

  console.log('  stripe (mock)...')
  await seedStripe()

  console.log('  shopify...')
  await seedViaOrchestrator('shopify')

  console.log('  salesforce...')
  await seedViaOrchestrator('salesforce')

  console.log('  csv...')
  await seedViaOrchestrator('csv', SAMPLE_CSV)

  console.log('  alert rules...')
  await seedAlertRules()

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
