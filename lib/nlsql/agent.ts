import Anthropic from '@anthropic-ai/sdk'
import { NlSqlSession, type SqlResult, type TableSchema } from './engine'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_ATTEMPTS = 3
const MAX_RESULT_ROWS = 1000

export interface NlSqlResponse {
  sql: string
  columns: string[]
  rows: Record<string, unknown>[]
}

function buildPrompt(schemas: TableSchema[], request: string): string {
  const tableList = schemas
    .map(
      (s) => `Table "${s.name}":\n${s.columns.map((c) => `  - "${c.name}" (${c.type})`).join('\n')}`
    )
    .join('\n\n')
  const tableNames = schemas.map((s) => `"${s.name}"`).join(', ')

  return `You are a SQL generator for DuckDB. The following table(s) are available:

${tableList}

All columns are stored as VARCHAR. Use CAST(... AS DOUBLE) or TRY_CAST for numeric comparisons/aggregates, and CAST(... AS DATE) or TRY_CAST(... AS DATE) for date operations.
${schemas.length > 1 ? `If the request requires combining data, JOIN across ${tableNames} using the appropriate matching columns.` : ''}

Write a single read-only SQL statement (SELECT or WITH ... SELECT only — no INSERT/UPDATE/DELETE/DDL) that satisfies this request:
"${request}"

Respond with ONLY the SQL statement, no markdown fences, no explanation.`
}

export async function runNlSqlQuery(
  session: NlSqlSession,
  request: string
): Promise<NlSqlResponse> {
  const schemas = session.getSchemas()
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildPrompt(schemas, request) },
  ]

  let lastError = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Model did not return SQL text')
    }

    const sql = textBlock.text
      .trim()
      .replace(/^```sql\s*|^```\s*|```$/gim, '')
      .trim()

    const cleaned = sql.replace(/;+\s*$/, '')
    const boundedSql = /\blimit\s+\d+\s*$/i.test(cleaned)
      ? cleaned
      : `${cleaned} LIMIT ${MAX_RESULT_ROWS}`

    let result: SqlResult
    try {
      result = await session.query(boundedSql)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      messages.push({ role: 'assistant', content: sql })
      messages.push({
        role: 'user',
        content: `That query failed with this error:\n${lastError}\n\nFix the SQL and respond with ONLY the corrected statement, no markdown fences, no explanation.`,
      })
      continue
    }

    return { sql, columns: result.columns, rows: result.rows }
  }

  throw new Error(`Failed to generate valid SQL after ${MAX_ATTEMPTS} attempts: ${lastError}`)
}
