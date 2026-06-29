import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import type { TransformNodeData } from '../types'
import type { TransformRuleType } from '@/lib/engine/transformRegistry'
import type { CastType } from '@/lib/transforms/cast'
import type { DeriveOperator, DeriveRule } from '@/lib/transforms/derive'

const RULE_TYPES: TransformRuleType[] = ['filter', 'rename', 'cast', 'derive', 'dedupe']
const CAST_TYPES: CastType[] = ['string', 'number', 'date', 'boolean']
const DERIVE_OPS: DeriveOperator[] = ['+', '-', '*', '/']

function selectClass() {
  return 'h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10'
}

function defaultConfig(ruleType: TransformRuleType): Record<string, unknown> {
  switch (ruleType) {
    case 'filter':
      return { expression: '' }
    case 'rename':
      return { columnMap: {} }
    case 'cast':
      return { columnTypes: {} }
    case 'derive':
      return { rules: [] }
    case 'dedupe':
      return { keyFields: [] }
  }
}

export function TransformPanel({
  data,
  onChange,
}: {
  data: TransformNodeData
  onChange: (data: TransformNodeData) => void
}) {
  const ruleType = data.ruleType
  const config = data.config ?? {}

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Label
        <Input
          value={data.label ?? ''}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Rule type
        <select
          className={selectClass()}
          value={ruleType ?? ''}
          onChange={(e) => {
            const next = e.target.value as TransformRuleType
            onChange({ ...data, ruleType: next, config: defaultConfig(next) })
          }}
        >
          <option value="" disabled>
            Select a rule type
          </option>
          {RULE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      {ruleType === 'filter' && (
        <FilterConfigEditor config={config} onChange={(c) => onChange({ ...data, config: c })} />
      )}
      {ruleType === 'rename' && (
        <RenameConfigEditor config={config} onChange={(c) => onChange({ ...data, config: c })} />
      )}
      {ruleType === 'cast' && (
        <CastConfigEditor config={config} onChange={(c) => onChange({ ...data, config: c })} />
      )}
      {ruleType === 'derive' && (
        <DeriveConfigEditor config={config} onChange={(c) => onChange({ ...data, config: c })} />
      )}
      {ruleType === 'dedupe' && (
        <DedupeConfigEditor config={config} onChange={(c) => onChange({ ...data, config: c })} />
      )}
    </div>
  )
}

function FilterConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const expression = (config.expression as string) ?? ''
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
      Expression
      <Input
        placeholder="amount > 1000 AND status == 'completed'"
        value={expression}
        onChange={(e) => onChange({ ...config, expression: e.target.value })}
      />
      <span className="text-zinc-400">Single AND/OR group only, no parentheses.</span>
    </label>
  )
}

function RenameConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const columnMap = (config.columnMap as Record<string, string>) ?? {}
  const entries = Object.entries(columnMap)

  function setEntries(next: [string, string][]) {
    onChange({ ...config, columnMap: Object.fromEntries(next) })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-500">Column rename map</span>
      {entries.map(([from, to], i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="old name"
            value={from}
            onChange={(e) => {
              const next = [...entries]
              next[i] = [e.target.value, to]
              setEntries(next)
            }}
          />
          <Input
            placeholder="new name"
            value={to}
            onChange={(e) => {
              const next = [...entries]
              next[i] = [from, e.target.value]
              setEntries(next)
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEntries(entries.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setEntries([...entries, ['', '']])}>
        <Plus className="h-4 w-4" /> Add mapping
      </Button>
    </div>
  )
}

function CastConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const columnTypes = (config.columnTypes as Record<string, CastType>) ?? {}
  const entries = Object.entries(columnTypes)

  function setEntries(next: [string, CastType][]) {
    onChange({ ...config, columnTypes: Object.fromEntries(next) })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-500">Column types</span>
      {entries.map(([column, type], i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="column"
            value={column}
            onChange={(e) => {
              const next = [...entries]
              next[i] = [e.target.value, type]
              setEntries(next)
            }}
          />
          <select
            className={selectClass()}
            value={type}
            onChange={(e) => {
              const next = [...entries]
              next[i] = [column, e.target.value as CastType]
              setEntries(next)
            }}
          >
            {CAST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEntries(entries.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setEntries([...entries, ['', 'string']])}>
        <Plus className="h-4 w-4" /> Add column
      </Button>
    </div>
  )
}

function DeriveConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const rules = (config.rules as DeriveRule[]) ?? []

  function setRules(next: DeriveRule[]) {
    onChange({ ...config, rules: next })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-500">Derived columns</span>
      {rules.map((rule, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="output field"
            value={rule.outputField}
            onChange={(e) => {
              const next = [...rules]
              next[i] = { ...rule, outputField: e.target.value }
              setRules(next)
            }}
          />
          <Input
            placeholder="left"
            value={rule.left}
            onChange={(e) => {
              const next = [...rules]
              next[i] = { ...rule, left: e.target.value }
              setRules(next)
            }}
          />
          <select
            className={selectClass()}
            value={rule.operator}
            onChange={(e) => {
              const next = [...rules]
              next[i] = { ...rule, operator: e.target.value as DeriveOperator }
              setRules(next)
            }}
          >
            {DERIVE_OPS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <Input
            placeholder="right"
            value={rule.right}
            onChange={(e) => {
              const next = [...rules]
              next[i] = { ...rule, right: e.target.value }
              setRules(next)
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRules(rules.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setRules([...rules, { outputField: '', left: '', operator: '+', right: '' }])
        }
      >
        <Plus className="h-4 w-4" /> Add rule
      </Button>
    </div>
  )
}

function DedupeConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const keyFields = ((config.keyFields as string[]) ?? []).join(', ')
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
      Key fields (comma-separated)
      <Input
        placeholder="customerId, transactionDate"
        value={keyFields}
        onChange={(e) =>
          onChange({
            ...config,
            keyFields: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />
    </label>
  )
}
