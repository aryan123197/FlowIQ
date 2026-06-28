'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Analytics</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {(metricsError || timeseriesError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          Failed to load analytics data.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Revenue" value={`$${((metrics?.totalRevenue ?? 0) / 100).toFixed(2)}`} />
        <KpiCard title="Transactions" value={String(metrics?.transactionCount ?? 0)} />
        <KpiCard title="Avg Transaction" value={`$${((metrics?.avgTransactionValue ?? 0) / 100).toFixed(2)}`} />
        <KpiCard
          title="Failed Rate"
          value={`${((metrics?.failedTransactionRate ?? 0) * 100).toFixed(1)}%`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={timeseries ?? []} />
        </div>
        <PlatformDonut data={metrics?.platformBreakdown ?? []} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TransactionTable range={range} />
        </div>
        <InsightPanel />
      </div>
    </div>
  )
}
