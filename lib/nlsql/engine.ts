import { DuckDBInstance } from '@duckdb/node-api'
import Papa from 'papaparse'

export interface TableSchema {
  name: string
  columns: { name: string; type: string }[]
}

export interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|attach|detach|copy|export|import|pragma|install|load|call)\b/i

export function assertReadOnlySelect(sql: string): void {
  const trimmed = sql.trim().replace(/;+\s*$/, '')
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error('Only SELECT (or WITH ... SELECT) statements are allowed.')
  }
  if (FORBIDDEN_KEYWORDS.test(trimmed)) {
    throw new Error('Statement contains a disallowed keyword.')
  }
  if (trimmed.includes(';')) {
    throw new Error('Only a single statement is allowed.')
  }
}

export interface TabularSource {
  tableName: string
  columns: string[]
  rows: Record<string, unknown>[]
}

export class NlSqlSession {
  private instance: DuckDBInstance | null = null
  private schemas: TableSchema[] = []

  private async ensureInstance(): Promise<DuckDBInstance> {
    if (!this.instance) {
      this.instance = await DuckDBInstance.create(':memory:')
    }
    return this.instance
  }

  async loadCsv(csvContent: string, tableName = 'data'): Promise<TableSchema> {
    const parsed = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })
    if (parsed.errors.length > 0) {
      throw new Error(`CSV parse error: ${parsed.errors[0].message}`)
    }
    const headers = parsed.meta.fields ?? []
    if (headers.length === 0) {
      throw new Error('CSV has no headers')
    }

    return this.loadTable({ tableName, columns: headers, rows: parsed.data })
  }

  async loadTable(source: TabularSource): Promise<TableSchema> {
    const instance = await this.ensureInstance()
    const connection = await instance.connect()
    const { tableName, columns, rows } = source

    await connection.run(
      `CREATE TABLE ${tableName} (${columns
        .map((c) => `"${c.replace(/"/g, '""')}" VARCHAR`)
        .join(', ')})`
    )

    const appender = await connection.createAppender(tableName)
    for (const row of rows) {
      for (const c of columns) {
        const v = row[c]
        if (v === undefined || v === null || v === '') {
          appender.appendNull()
        } else {
          appender.appendVarchar(String(v))
        }
      }
      appender.endRow()
    }
    appender.flushSync()
    appender.closeSync()

    const described = await connection.runAndReadAll(`DESCRIBE ${tableName}`)
    const descRows = described.getRowObjectsJson() as { column_name: string; column_type: string }[]
    const schema: TableSchema = {
      name: tableName,
      columns: descRows.map((r) => ({ name: r.column_name, type: r.column_type })),
    }
    this.schemas.push(schema)
    return schema
  }

  getSchema(): TableSchema {
    if (this.schemas.length === 0) throw new Error('No table loaded')
    return this.schemas[0]
  }

  getSchemas(): TableSchema[] {
    if (this.schemas.length === 0) throw new Error('No table loaded')
    return this.schemas
  }

  async query(sql: string): Promise<SqlResult> {
    if (!this.instance) throw new Error('No table loaded')
    assertReadOnlySelect(sql)

    const connection = await this.instance.connect()
    const reader = await connection.runAndReadAll(sql)
    const columns = reader.columnNames()
    const rows = reader.getRowObjectsJson() as Record<string, unknown>[]
    return { columns, rows }
  }

  close(): void {
    this.instance?.closeSync()
    this.instance = null
  }
}
