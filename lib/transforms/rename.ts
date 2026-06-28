export interface RenameConfig {
  columnMap: Record<string, string> // oldName -> newName
}

export function applyRename(rows: Record<string, unknown>[], config: RenameConfig): Record<string, unknown>[] {
  return rows.map((row) => {
    const renamed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      const newKey = config.columnMap[key] ?? key
      renamed[newKey] = value
    }
    return renamed
  })
}
