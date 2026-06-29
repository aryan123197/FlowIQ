'use client'

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import type { AlertTrigger } from './types'

export function TriggerHistory({ ruleId }: { ruleId?: string }) {
  const { data: triggers, error } = useQuery({
    queryKey: ['alert-triggers', ruleId],
    queryFn: async () => {
      const params = ruleId ? `?ruleId=${ruleId}` : ''
      const res = await fetch(`/api/alerts/triggers${params}`)
      if (!res.ok) throw new Error('Failed to load trigger history')
      return res.json() as Promise<AlertTrigger[]>
    },
  })

  if (error) {
    return <p className="text-sm text-red-600">Failed to load trigger history.</p>
  }

  if (!triggers?.length) {
    return <p className="text-sm text-zinc-400">No triggers yet.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {triggers.map((trigger) => (
        <li
          key={trigger.id}
          className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm"
        >
          <span className="text-zinc-900">value: {trigger.value}</span>
          <span className="text-zinc-400">{new Date(trigger.triggeredAt).toLocaleString()}</span>
          <Badge variant={trigger.resolvedAt ? 'success' : 'warning'}>
            {trigger.resolvedAt ? 'resolved' : 'active'}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
