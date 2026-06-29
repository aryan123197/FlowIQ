import type { Platform } from '@/types'
import type { TransformRuleType } from '@/lib/engine/transformRegistry'

export interface SourceNodeData {
  label?: string
  platform?: Platform
}

export interface TransformNodeData {
  label?: string
  ruleType?: TransformRuleType
  config?: Record<string, unknown>
}

export interface SinkNodeData {
  label?: string
}

export type PipelineNodeType = 'source' | 'transform' | 'sink'
