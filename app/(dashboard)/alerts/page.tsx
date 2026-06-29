'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertRuleForm, type AlertRuleFormValues } from '@/components/alerts/AlertRuleForm'
import { AlertRuleCard } from '@/components/alerts/AlertRuleCard'
import { TriggerHistory } from '@/components/alerts/TriggerHistory'
import type { AlertRule } from '@/components/alerts/types'

export default function AlertsPage() {
  const queryClient = useQueryClient()
  const [selectedRuleId, setSelectedRuleId] = useState<string | undefined>(undefined)

  const { data: rules, error } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const res = await fetch('/api/alerts')
      if (!res.ok) throw new Error('Failed to load alert rules')
      return res.json() as Promise<AlertRule[]>
    },
  })

  const createRule = useMutation({
    mutationFn: async (values: AlertRuleFormValues) => {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Failed to create alert rule')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  })

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error('Failed to update alert rule')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  })

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete alert rule')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-zinc-900">Alerts</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          Failed to load alert rules.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-500">Rules</h2>
          {rules?.map((rule) => (
            <div
              key={rule.id}
              onClick={() => setSelectedRuleId(rule.id)}
              className="cursor-pointer"
            >
              <AlertRuleCard
                rule={rule}
                onToggle={(enabled) => toggleRule.mutate({ id: rule.id, enabled })}
                onDelete={() => deleteRule.mutate(rule.id)}
              />
            </div>
          ))}
          {rules?.length === 0 && <p className="text-sm text-zinc-400">No alert rules yet.</p>}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">New rule</h2>
            <AlertRuleForm
              onSubmit={(values) => createRule.mutate(values)}
              submitting={createRule.isPending}
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">
              {selectedRuleId ? 'Trigger history' : 'All triggers'}
            </h2>
            <TriggerHistory ruleId={selectedRuleId} />
          </div>
        </div>
      </div>
    </div>
  )
}
