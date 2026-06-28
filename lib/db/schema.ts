import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, numeric, pgEnum, unique } from 'drizzle-orm/pg-core'

export const platformEnum = pgEnum('platform', ['stripe', 'shopify', 'salesforce', 'csv'])
export const syncStatusEnum = pgEnum('sync_status', ['pending', 'running', 'completed', 'failed'])
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'pending', 'failed', 'refunded', 'cancelled'])
export const alertMetricEnum = pgEnum('alert_metric', ['revenue_total', 'transaction_count', 'failed_transaction_rate', 'customer_count'])
export const alertOperatorEnum = pgEnum('alert_operator', ['gt', 'lt', 'gte', 'lte', 'eq'])
export const alertActionEnum = pgEnum('alert_action', ['email', 'slack'])

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  stripeId: varchar('stripe_id', { length: 255 }).unique(),
  shopifyId: varchar('shopify_id', { length: 255 }).unique(),
  salesforceId: varchar('salesforce_id', { length: 255 }).unique(),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').references(() => customers.id),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  status: transactionStatusEnum('status').notNull(),
  sourcePlatform: platformEnum('source_platform').notNull(),
  sourceTransactionId: varchar('source_transaction_id', { length: 255 }).notNull(),
  transactionDate: timestamp('transaction_date').notNull(),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique('uniq_platform_txn').on(t.sourcePlatform, t.sourceTransactionId),
])

export const syncJobs = pgTable('sync_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourcePlatform: platformEnum('source_platform').notNull(),
  status: syncStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  recordsProcessed: integer('records_processed').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  errorDetails: jsonb('error_details').$type<{ message: string; record?: unknown }[]>().default([]),
})

export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  metric: alertMetricEnum('metric').notNull(),
  threshold: numeric('threshold', { precision: 15, scale: 2 }).notNull(),
  comparisonOperator: alertOperatorEnum('comparison_operator').notNull(),
  timeWindow: varchar('time_window', { length: 20 }).notNull().default('24h'),
  actionType: alertActionEnum('action_type').notNull(),
  actionConfig: jsonb('action_config').$type<{ to?: string; webhookUrl?: string }>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const alertTriggers = pgTable('alert_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id').references(() => alertRules.id).notNull(),
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
  value: numeric('value', { precision: 15, scale: 2 }).notNull(),
  context: jsonb('context').$type<Record<string, unknown>>().default({}),
  resolvedAt: timestamp('resolved_at'),
})

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type SyncJob = typeof syncJobs.$inferSelect
export type AlertRule = typeof alertRules.$inferSelect
export type AlertTrigger = typeof alertTriggers.$inferSelect

export const pipelineStepStatusEnum = pgEnum('pipeline_step_status', ['pending', 'running', 'completed', 'failed', 'skipped'])

export const pipelines = pgTable('pipelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  graphJson: jsonb('graph_json').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const pipelineRuns = pgTable('pipeline_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  pipelineId: uuid('pipeline_id').notNull().references(() => pipelines.id, { onDelete: 'cascade' }),
  status: syncStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  errorDetails: jsonb('error_details').$type<{ message: string }[]>(),
})

export const pipelineSteps = pgTable('pipeline_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => pipelineRuns.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 100 }).notNull(),
  nodeType: varchar('node_type', { length: 50 }).notNull(),
  status: pipelineStepStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  outputMeta: jsonb('output_meta').$type<{ recordCount: number; sampleRows?: unknown[] }>(),
  errorMsg: text('error_msg'),
})

export const transformRules = pgTable('transform_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  pipelineId: uuid('pipeline_id').notNull().references(() => pipelines.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 100 }).notNull(),
  ruleType: varchar('rule_type', { length: 50 }).notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  orderIndex: integer('order_index').notNull().default(0),
})

export const pipelineOutputs = pgTable('pipeline_outputs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => pipelineRuns.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 100 }).notNull(),
  row: jsonb('row').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Pipeline = typeof pipelines.$inferSelect
export type PipelineRun = typeof pipelineRuns.$inferSelect
export type PipelineStep = typeof pipelineSteps.$inferSelect
export type TransformRule = typeof transformRules.$inferSelect
export type PipelineOutput = typeof pipelineOutputs.$inferSelect
