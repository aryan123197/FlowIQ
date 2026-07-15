'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, ArrowLeftRight, TrendingUp, AlertTriangle, Users } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { RevenueChart } from '@/components/analytics/RevenueChart'
import { PlatformDonut } from '@/components/analytics/PlatformDonut'
import { TransactionTable } from '@/components/analytics/TransactionTable'
import { InsightPanel } from '@/components/analytics/InsightPanel'
import { DateRangePicker, type DateRange } from '@/components/analytics/DateRangePicker'

interface Metrics {
  totalRevenue: number
  transactionCount: number
  avgTransactionValue: number
  customerCount: number
  failedTransactionRate: number
  platformBreakdown: { platform: string; revenue: number; count: number }[]
}

interface TimeseriesPoint {
  date: string
  stripe: number
  shopify: number
  salesforce: number
  csv: number
  total: number
}

function buildQuery(range: DateRange) {
  const params = new URLSearchParams()
  if (range.dateFrom) params.set('dateFrom', range.dateFrom)
  if (range.dateTo) params.set('dateTo', range.dateTo)
  return params.toString()
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>({ dateFrom: '', dateTo: '' })
  const query = buildQuery(range)

  const { data: metrics, error: metricsError } = useQuery({
    queryKey: ['metrics', range],
    queryFn: async () => {
      const res = await fetch(`/api/data/metrics${query ? `?${query}` : ''}`)
      if (!res.ok) throw new Error('Failed to load metrics')
      return res.json() as Promise<Metrics>
    },
  })

  const { data: timeseries, error: timeseriesError } = useQuery({
    queryKey: ['timeseries', range],
    queryFn: async () => {
      const res = await fetch(`/api/data/timeseries${query ? `?${query}` : ''}`)
      if (!res.ok) throw new Error('Failed to load timeseries')
      const json = await res.json()
      return json.timeseries as TimeseriesPoint[]
    },
  })

  const now = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-400">Last refreshed {now}</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {(metricsError || timeseriesError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Failed to load analytics data.
        </div>
      )}

      {/* KPI row */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Overview
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Revenue"
            value={`$${((metrics?.totalRevenue ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            accent="indigo"
          />
          <KpiCard
            title="Transactions"
            value={String(metrics?.transactionCount ?? 0)}
            icon={ArrowLeftRight}
            accent="violet"
          />
          <KpiCard
            title="Avg Transaction"
            value={`$${((metrics?.avgTransactionValue ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={TrendingUp}
            accent="emerald"
          />
          <KpiCard
            title="Failed Rate"
            value={`${((metrics?.failedTransactionRate ?? 0) * 100).toFixed(1)}%`}
            icon={AlertTriangle}
            accent="rose"
          />
        </div>
      </div>

      {/* Charts */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Revenue Trends
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueChart data={timeseries ?? []} />
          </div>
          <PlatformDonut data={metrics?.platformBreakdown ?? []} />
        </div>
      </div>

      {/* Table + Insights */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Transactions &amp; Insights
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TransactionTable range={range} />
          </div>
          <InsightPanel />
        </div>
      </div>
    </div>
  )
}
