'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PLATFORM_COLORS } from '@/lib/constants'

interface PlatformSlice {
  platform: string
  revenue: number
  count: number
}

function downloadCsv(data: PlatformSlice[]) {
  const cols = ['platform', 'revenue_cents', 'revenue_dollars', 'transaction_count']
  const rows = data.map((d) => [
    d.platform,
    String(d.revenue),
    (d.revenue / 100).toFixed(2),
    String(d.count),
  ])
  const csv = [cols.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'platform-breakdown.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function PlatformDonut({ data }: { data: PlatformSlice[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Revenue by Platform</CardTitle>
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
            <PieChart>
              <Pie
                data={data}
                dataKey="revenue"
                nameKey="platform"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((slice) => (
                  <Cell key={slice.platform} fill={PLATFORM_COLORS[slice.platform] ?? '#a1a1aa'} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `$${(Number(v) / 100).toFixed(2)}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
