import { NextRequest, NextResponse } from 'next/server'
import { NlSqlSession } from '@/lib/nlsql/engine'
import { runNlSqlQuery } from '@/lib/nlsql/agent'
import { loadPgTable, PG_TABLES, type PgTableName } from '@/lib/nlsql/postgresSource'

export async function POST(req: NextRequest) {
  let body: { source?: 'csv' | 'tables'; csvContent?: string; tables?: string[]; prompt?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 })
  }

  const { source = 'csv', csvContent, tables, prompt } = body
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const session = new NlSqlSession()
  try {
    if (source === 'csv') {
      if (!csvContent?.trim()) {
        return NextResponse.json({ error: 'csvContent is required' }, { status: 400 })
      }
      await session.loadCsv(csvContent)
    } else if (source === 'tables') {
      const requested = tables?.length ? tables : PG_TABLES
      const invalid = requested.filter((t) => !PG_TABLES.includes(t as PgTableName))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Unknown table(s): ${invalid.join(', ')}` },
          { status: 400 }
        )
      }
      for (const table of requested as PgTableName[]) {
        await loadPgTable(session, table)
      }
    } else {
      return NextResponse.json({ error: 'source must be "csv" or "tables"' }, { status: 400 })
    }

    const result = await runNlSqlQuery(session, prompt)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    )
  } finally {
    session.close()
  }
}
