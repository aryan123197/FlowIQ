import { describe, it, expect } from 'vitest'
import { applyFilter } from '@/lib/transforms/filter'
import { applyRename } from '@/lib/transforms/rename'
import { applyCast } from '@/lib/transforms/cast'
import { applyDerive } from '@/lib/transforms/derive'
import { applyDedupe } from '@/lib/transforms/dedupe'

describe('applyFilter', () => {
  const rows = [
    { amount: 1500, status: 'completed' },
    { amount: 500, status: 'completed' },
    { amount: 2000, status: 'failed' },
  ]

  it('filters with a single numeric comparison', () => {
    const result = applyFilter(rows, { expression: 'amount > 1000' })
    expect(result).toHaveLength(2)
  })

  it('filters with a string equality comparison', () => {
    const result = applyFilter(rows, { expression: "status == 'completed'" })
    expect(result).toHaveLength(2)
  })

  it('combines comparisons with AND', () => {
    const result = applyFilter(rows, { expression: "amount > 1000 AND status == 'completed'" })
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(1500)
  })

  it('combines comparisons with OR', () => {
    const result = applyFilter(rows, { expression: "amount > 1900 OR status == 'failed'" })
    expect(result).toHaveLength(1)
  })

  it('rejects mixed AND/OR without parentheses', () => {
    expect(() => applyFilter(rows, { expression: "amount > 100 AND status == 'completed' OR amount > 50" })).toThrow(/Mixing/)
  })

  it('never uses eval or new Function (safety check via no global pollution)', () => {
    // A malicious expression attempting code injection should just throw a parse error, not execute.
    expect(() => applyFilter(rows, { expression: 'amount > 1; process.exit()' })).toThrow()
  })

  it('throws on malformed expressions', () => {
    expect(() => applyFilter(rows, { expression: 'amount >' })).toThrow()
  })
})

describe('applyRename', () => {
  it('renames specified columns and leaves others untouched', () => {
    const result = applyRename([{ amt: 100, status: 'ok' }], { columnMap: { amt: 'amount' } })
    expect(result).toEqual([{ amount: 100, status: 'ok' }])
  })
})

describe('applyCast', () => {
  it('casts string to number', () => {
    const result = applyCast([{ amount: '100' }], { columnTypes: { amount: 'number' } })
    expect(result[0].amount).toBe(100)
  })

  it('casts string to date', () => {
    const result = applyCast([{ date: '2024-01-01' }], { columnTypes: { date: 'date' } })
    expect(result[0].date).toBeInstanceOf(Date)
  })

  it('casts to boolean', () => {
    const result = applyCast([{ active: 'true' }], { columnTypes: { active: 'boolean' } })
    expect(result[0].active).toBe(true)
  })

  it('throws when a value cannot be cast to number', () => {
    expect(() => applyCast([{ amount: 'not-a-number' }], { columnTypes: { amount: 'number' } })).toThrow()
  })

  it('leaves null/undefined values untouched', () => {
    const result = applyCast([{ amount: null }], { columnTypes: { amount: 'number' } })
    expect(result[0].amount).toBeNull()
  })
})

describe('applyDerive', () => {
  it('computes a derived field from two existing fields', () => {
    const result = applyDerive([{ amount: 100, taxRate: 0.08 }], {
      rules: [{ outputField: 'tax', left: 'amount', operator: '*', right: 'taxRate' }],
    })
    expect(result[0].tax).toBeCloseTo(8)
  })

  it('supports numeric literals as operands', () => {
    const result = applyDerive([{ amount: 100 }], {
      rules: [{ outputField: 'doubled', left: 'amount', operator: '*', right: '2' }],
    })
    expect(result[0].doubled).toBe(200)
  })

  it('throws on division by zero', () => {
    expect(() => applyDerive([{ amount: 100 }], {
      rules: [{ outputField: 'x', left: 'amount', operator: '/', right: '0' }],
    })).toThrow(/Division by zero/)
  })
})

describe('applyDedupe', () => {
  it('removes duplicate rows by key fields, keeping the first occurrence', () => {
    const rows = [
      { id: '1', email: 'a@a.com', amount: 100 },
      { id: '2', email: 'a@a.com', amount: 200 },
      { id: '3', email: 'b@b.com', amount: 300 },
    ]
    const result = applyDedupe(rows, { keyFields: ['email'] })
    expect(result).toHaveLength(2)
    expect(result[0].amount).toBe(100)
  })

  it('supports composite keys', () => {
    const rows = [
      { platform: 'stripe', sourceId: 'a', amount: 1 },
      { platform: 'shopify', sourceId: 'a', amount: 2 },
    ]
    const result = applyDedupe(rows, { keyFields: ['platform', 'sourceId'] })
    expect(result).toHaveLength(2)
  })
})
