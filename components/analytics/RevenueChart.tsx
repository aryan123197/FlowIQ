'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { PLATFORM_COLORS } from '@/lib/constants'

interface TimeseriesPoint {
  date: string
  stripe: number
  shopify: number
  salesforce: number
  csv: number
  total: number
}

function downloadCsv(data: TimeseriesPoint[]) {
  const platforms = Object.keys(PLATFORM_COLORS) as (keyof typeof PLATFORM_COLORS)[]
  const cols = ['date', ...platforms, 'total']
  const rows = data.map((d) =>
    cols.map((c) => String((d as unknown as Record<string, unknown>)[c] ?? 0))
  )
  const csv = [cols.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'revenue-timeseries.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function RevenueChart({ data }: { data: TimeseriesPoint[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Revenue Over Time</CardTitle>
        <button
          type="button"
          onClick={() => downloadCsv(data)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Download CSV
        </button>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
              <Tooltip formatter={(v) => `$${(Number(v) / 100).toFixed(2)}`} />
              <Legend />
              {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
                <Line
                  key={platform}
                  type="monotone"
                  dataKey={platform}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
