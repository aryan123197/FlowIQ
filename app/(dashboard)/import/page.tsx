'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'

type Status = 'idle' | 'preview' | 'uploading' | 'done' | 'error'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ columns: string[]; rows: Record<string, string>[] }>({
    columns: [],
    rows: [],
  })
  const [status, setStatus] = useState<Status>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function loadPreview(f: File) {
    setFile(f)
    setStatus('idle')
    setJobId(null)
    setErrorMsg(null)
    Papa.parse<Record<string, string>>(f, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
      complete(results) {
        setPreview({
          columns: results.meta.fields ?? [],
          rows: results.data,
        })
        setStatus('preview')
      },
      error(err) {
        setErrorMsg(err.message)
        setStatus('error')
      },
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.toLowerCase().endsWith('.csv')) loadPreview(f)
    else setErrorMsg('Only .csv files are supported')
  }, [])

  async function handleUpload() {
    if (!file) return
    setStatus('uploading')
    setErrorMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/csv', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setJobId(data.jobId)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  function reset() {
    setFile(null)
    setPreview({ columns: [], rows: [] })
    setStatus('idle')
    setJobId(null)
    setErrorMsg(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-zinc-900">Import Data</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload a CSV file</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
              dragging
                ? 'border-zinc-400 bg-zinc-50'
                : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
            )}
          >
            <svg
              className="h-8 w-8 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-700">
              {file ? file.name : 'Drag & drop a CSV here, or click to browse'}
            </p>
            {file && <p className="text-xs text-zinc-400">{(file.size / 1024).toFixed(1)} KB</p>}
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) loadPreview(f)
              }}
            />
          </div>

          {status === 'error' && errorMsg && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {status === 'preview' && preview.columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Preview — {preview.columns.length} columns, showing first {preview.rows.length} rows
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <table className="min-w-full text-xs">
                <thead className="bg-zinc-50">
                  <tr>
                    {preview.columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-3 py-2 text-left font-medium text-zinc-700"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-3 py-2 text-zinc-600">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload}>Import into FlowIQ</Button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'uploading' && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Uploading and processing…
        </div>
      )}

      {status === 'done' && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium">Import started successfully.</p>
          <p className="mt-1 text-green-700">
            Job ID: <code className="font-mono">{jobId}</code> — data will appear in Analytics once
            the sync job completes.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}
