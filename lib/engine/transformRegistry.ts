import { applyFilter, type FilterConfig } from '@/lib/transforms/filter'
import { applyRename, type RenameConfig } from '@/lib/transforms/rename'
import { applyCast, type CastConfig } from '@/lib/transforms/cast'
import { applyDerive, type DeriveConfig } from '@/lib/transforms/derive'
import { applyDedupe, type DedupeConfig } from '@/lib/transforms/dedupe'

export type TransformRuleType = 'filter' | 'rename' | 'cast' | 'derive' | 'dedupe'

type TransformFn = (rows: Record<string, unknown>[], config: Record<string, unknown>) => Record<string, unknown>[]

export const transformRegistry: Record<TransformRuleType, TransformFn> = {
  filter: (rows, config) => applyFilter(rows, config as unknown as FilterConfig),
  rename: (rows, config) => applyRename(rows, config as unknown as RenameConfig),
  cast: (rows, config) => applyCast(rows, config as unknown as CastConfig),
  derive: (rows, config) => applyDerive(rows, config as unknown as DeriveConfig),
  dedupe: (rows, config) => applyDedupe(rows, config as unknown as DedupeConfig),
}

export function runTransform(
  ruleType: string,
  rows: Record<string, unknown>[],
  config: Record<string, unknown>
): Record<string, unknown>[] {
  const fn = transformRegistry[ruleType as TransformRuleType]
  if (!fn) throw new Error(`Unknown transform rule type: ${ruleType}`)
  return fn(rows, config)
}
