export type CastType = 'string' | 'number' | 'date' | 'boolean'

export interface CastConfig {
  columnTypes: Record<string, CastType>
}

function castValue(value: unknown, type: CastType): unknown {
  if (value === null || value === undefined) return value

  switch (type) {
    case 'string':
      return String(value)
    case 'number': {
      const n = Number(value)
      if (Number.isNaN(n)) throw new Error(`Cannot cast "${value}" to number`)
      return n
    }
    case 'date': {
      const d = new Date(value as string | number)
      if (Number.isNaN(d.getTime())) throw new Error(`Cannot cast "${value}" to date`)
      return d
    }
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') return value.toLowerCase() === 'true'
      return Boolean(value)
  }
}

export function applyCast(rows: Record<string, unknown>[], config: CastConfig): Record<string, unknown>[] {
  return rows.map((row) => {
    const cast: Record<string, unknown> = { ...row }
    for (const [column, type] of Object.entries(config.columnTypes)) {
      if (column in cast) cast[column] = castValue(cast[column], type)
    }
    return cast
  })
}
