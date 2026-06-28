'use client'

import { useQuery } from '@tanstack/react-query'
import { InsightCard } from './InsightCard'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Insight {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  recommendation: string
}

export function InsightPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch('/api/insights')
      if (!res.ok) throw new Error('Failed to load insights')
      return res.json() as Promise<{ insights: Insight[] }>
    },
    staleTime: 5 * 60_000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {error && <p className="text-sm text-red-600">Failed to generate insights.</p>}
        {data && (
          <div className="flex flex-col gap-3">
            {data.insights.length === 0 && <p className="text-sm text-zinc-500">No insights available yet.</p>}
            {data.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
