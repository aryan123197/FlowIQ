'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PLATFORM_COLORS } from '@/lib/constants'

interface PlatformSlice {
  platform: string
  revenue: number
  count: number
}

export function PlatformDonut({ data }: { data: PlatformSlice[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Platform</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="revenue" nameKey="platform" innerRadius={60} outerRadius={90} paddingAngle={2}>
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
