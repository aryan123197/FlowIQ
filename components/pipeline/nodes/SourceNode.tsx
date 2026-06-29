import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SourceNodeData } from '../types'

export function SourceNode({ data, selected }: NodeProps & { data: SourceNodeData }) {
  return (
    <div
      className={cn(
        'min-w-[160px] rounded-md border bg-white px-3 py-2 shadow-sm',
        selected ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200'
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        <Database className="h-4 w-4 text-emerald-600" />
        {data.label ?? 'Source'}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{data.platform ?? 'all platforms'}</div>
      <Handle type="source" position={Position.Right} className="!bg-emerald-600" />
    </div>
  )
}
