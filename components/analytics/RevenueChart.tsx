'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { PLATFORM_COLORS } from '@/lib/constants'

interface TimeseriesPoint {
  date: string
  stripe: number
  shopify: number
  salesforce: number
  csv: number
  total: number
}

export function RevenueChart({ data }: { data: TimeseriesPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
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
                <Line key={platform} type="monotone" dataKey={platform} stroke={color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
