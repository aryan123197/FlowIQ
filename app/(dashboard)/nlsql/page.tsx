'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface NlSqlResult {
  sql: string
  columns: string[]
  rows: Record<string, unknown>[]
}

type Source = 'csv' | 'tables'

const PG_TABLES = ['transactions', 'customers'] as const

export default function NlSqlPage() {
  const [source, setSource] = useState<Source>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [selectedTables, setSelectedTables] = useState<string[]>([...PG_TABLES])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NlSqlResult | null>(null)

  const canSubmit =
    prompt.trim().length > 0 && (source === 'csv' ? !!file : selectedTables.length > 0)

  function toggleTable(table: string) {
    setSelectedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]
    )
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const body =
        source === 'csv'
          ? { source, csvContent: await file!.text(), prompt }
          : { source, tables: selectedTables, prompt }

      const res = await fetch('/api/nlsql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-zinc-900">Ask your data in plain English</h1>

      <Card>
        <CardHeader>
          <CardTitle>Choose a data source and describe what you want</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="inline-flex gap-1 self-start rounded-md bg-zinc-100 p-1">
            {(['csv', 'tables'] as Source[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={cn(
                  'rounded-sm px-3 py-1 text-sm font-medium transition-colors',
                  source === s
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                )}
              >
                {s === 'csv' ? 'Upload CSV' : 'Pipeline data'}
              </button>
            ))}
          </div>

          {source === 'csv' ? (
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-zinc-700"
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-zinc-500">
                Queries a read-only snapshot of your synced data (most recent rows, capped).
              </span>
              <div className="flex gap-3">
                {PG_TABLES.map((table) => (
                  <label key={table} className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(table)}
                      onChange={() => toggleTable(table)}
                    />
                    {table}
                  </label>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              source === 'csv'
                ? 'e.g. "show total amount by status, sorted descending"'
                : 'e.g. "join transactions and customers, show total revenue per customer email"'
            }
            rows={3}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <div>
            <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
              {loading ? 'Running…' : 'Run'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Generated SQL</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
              {result.sql}
            </pre>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Results ({result.rows.length} rows)</CardTitle>
            <button
              type="button"
              onClick={() => {
                const header = result.columns.join(',')
                const body = result.rows
                  .map((row) =>
                    result.columns
                      .map((col) => {
                        const v = String(row[col] ?? '')
                        return v.includes(',') || v.includes('"') || v.includes('\n')
                          ? `"${v.replace(/"/g, '""')}"`
                          : v
                      })
                      .join(',')
                  )
                  .join('\n')
                const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'query-results.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Download CSV
            </button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    {result.columns.map((col) => (
                      <TableCell key={col}>{String(row[col] ?? '')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
