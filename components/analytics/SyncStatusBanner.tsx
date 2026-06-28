'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

interface SyncJob {
  id: string
  sourcePlatform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  recordsProcessed: number
  errorCount: number
  startedAt: string
  completedAt: string | null
}

const ACTIVE_STATUSES = new Set(['pending', 'running'])

export function SyncStatusBanner() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/sync/status?limit=1')
      if (!res.ok) throw new Error('Failed to load sync status')
      const json = await res.json()
      return json.jobs?.[0] as SyncJob | undefined
    },
    refetchInterval: 10_000,
  })

  const [liveJob, setLiveJob] = useState<Partial<SyncJob> | null>(null)

  useEffect(() => {
    if (!data || !ACTIVE_STATUSES.has(data.status)) {
      setLiveJob(null)
      return
    }

    const source = new EventSource(`/api/sync/${data.id}/stream`)
    source.addEventListener('status', (event) => {
      const payload = JSON.parse(event.data)
      setLiveJob(payload)
      if (payload.status === 'completed' || payload.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: ['sync-status'] })
        queryClient.invalidateQueries({ queryKey: ['metrics'] })
        queryClient.invalidateQueries({ queryKey: ['timeseries'] })
        source.close()
      }
    })
    source.onerror = () => source.close()

    return () => source.close()
  }, [data?.id, data?.status, queryClient])

  const job = data ? { ...data, ...liveJob } : liveJob
  if (!job) return <div />

  return (
    <div className="flex items-center gap-2 text-sm">
      {ACTIVE_STATUSES.has(job.status ?? '') && <Spinner />}
      <span className="text-zinc-500">
        Last sync: <span className="font-medium text-zinc-900">{job.sourcePlatform}</span>
      </span>
      <StatusBadge status={job.status} />
      {job.status === 'running' && job.recordsProcessed !== undefined && (
        <span className="text-zinc-400">{job.recordsProcessed} records</span>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  if (status === 'completed') return <Badge variant="success">completed</Badge>
  if (status === 'failed') return <Badge variant="danger">failed</Badge>
  if (status === 'running') return <Badge variant="info">running</Badge>
  return <Badge variant="default">{status ?? 'unknown'}</Badge>
}
