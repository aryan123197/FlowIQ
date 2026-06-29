import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransformNodeData } from '../types'

export function TransformNode({ data, selected }: NodeProps & { data: TransformNodeData }) {
  return (
    <div
      className={cn(
        'min-w-[160px] rounded-md border bg-white px-3 py-2 shadow-sm',
        selected ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-600" />
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        <Wand2 className="h-4 w-4 text-indigo-600" />
        {data.label ?? 'Transform'}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{data.ruleType ?? 'unconfigured'}</div>
      <Handle type="source" position={Position.Right} className="!bg-indigo-600" />
    </div>
  )
}
