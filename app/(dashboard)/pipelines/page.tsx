'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

interface Pipeline {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export default function PipelinesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')

  const { data: pipelines, error } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const res = await fetch('/api/pipelines')
      if (!res.ok) throw new Error('Failed to load pipelines')
      return res.json() as Promise<Pipeline[]>
    },
  })

  const createPipeline = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, graphJson: { nodes: [], edges: [] } }),
      })
      if (!res.ok) throw new Error('Failed to create pipeline')
      return res.json() as Promise<Pipeline>
    },
    onSuccess: (pipeline) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      router.push(`/pipelines/${pipeline.id}`)
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Pipelines</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="New pipeline name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-56"
          />
          <Button
            size="sm"
            disabled={!newName.trim() || createPipeline.isPending}
            onClick={() => createPipeline.mutate(newName.trim())}
          >
            <Plus className="h-4 w-4" /> New Pipeline
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          Failed to load pipelines.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pipelines?.map((pipeline) => (
          <Card
            key={pipeline.id}
            className="cursor-pointer hover:border-zinc-300"
            onClick={() => router.push(`/pipelines/${pipeline.id}`)}
          >
            <CardHeader>
              <CardTitle className="text-zinc-900">{pipeline.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500">{pipeline.description ?? 'No description'}</p>
              <p className="mt-2 text-xs text-zinc-400">
                Updated {new Date(pipeline.updatedAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
        {pipelines?.length === 0 && (
          <p className="text-sm text-zinc-400">No pipelines yet. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
