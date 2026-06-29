'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { AlertMetric, AlertOperator, AlertAction } from './types'

const METRICS: AlertMetric[] = [
  'revenue_total',
  'transaction_count',
  'failed_transaction_rate',
  'customer_count',
]
const OPERATORS: AlertOperator[] = ['gt', 'lt', 'gte', 'lte', 'eq']
const ACTIONS: AlertAction[] = ['email', 'slack']

const OPERATOR_LABELS: Record<AlertOperator, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  eq: '==',
}

function selectClass() {
  return 'h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10'
}

export interface AlertRuleFormValues {
  name: string
  metric: AlertMetric
  threshold: number
  comparisonOperator: AlertOperator
  timeWindow: string
  actionType: AlertAction
  actionConfig: { to?: string; webhookUrl?: string }
}

export function AlertRuleForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (values: AlertRuleFormValues) => void
  submitting?: boolean
}) {
  const [name, setName] = useState('')
  const [metric, setMetric] = useState<AlertMetric>('revenue_total')
  const [threshold, setThreshold] = useState('')
  const [comparisonOperator, setComparisonOperator] = useState<AlertOperator>('gt')
  const [timeWindow, setTimeWindow] = useState('24h')
  const [actionType, setActionType] = useState<AlertAction>('email')
  const [actionTarget, setActionTarget] = useState('')

  const canSubmit =
    name.trim() && threshold.trim() && !Number.isNaN(Number(threshold)) && actionTarget.trim()

  function handleSubmit() {
    onSubmit({
      name: name.trim(),
      metric,
      threshold: Number(threshold),
      comparisonOperator,
      timeWindow,
      actionType,
      actionConfig:
        actionType === 'email' ? { to: actionTarget.trim() } : { webhookUrl: actionTarget.trim() },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Rule name
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="High failed rate"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Metric
          <select
            className={selectClass()}
            value={metric}
            onChange={(e) => setMetric(e.target.value as AlertMetric)}
          >
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Time window
          <Input
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            placeholder="24h"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Operator
          <select
            className={selectClass()}
            value={comparisonOperator}
            onChange={(e) => setComparisonOperator(e.target.value as AlertOperator)}
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Threshold
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="1000"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Action
          <select
            className={selectClass()}
            value={actionType}
            onChange={(e) => setActionType(e.target.value as AlertAction)}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          {actionType === 'email' ? 'Email address' : 'Webhook URL'}
          <Input
            value={actionTarget}
            onChange={(e) => setActionTarget(e.target.value)}
            placeholder={
              actionType === 'email' ? 'alerts@company.com' : 'https://hooks.slack.com/...'
            }
          />
        </label>
      </div>

      <Button disabled={!canSubmit || submitting} onClick={handleSubmit}>
        {submitting ? 'Creating...' : 'Create rule'}
      </Button>
    </div>
  )
}
