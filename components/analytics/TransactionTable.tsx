'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCoreRowModel, useReactTable, createColumnHelper, flexRender } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { DateRange } from '@/components/analytics/DateRangePicker'

interface TransactionRow {
  id: string
  amount: number
  currency: string
  status: string
  sourcePlatform: string
  transactionDate: string
}

const columnHelper = createColumnHelper<TransactionRow>()

const columns = [
  columnHelper.accessor('transactionDate', {
    header: 'Date',
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
  columnHelper.accessor('sourcePlatform', {
    header: 'Platform',
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: (info) => `$${(info.getValue() / 100).toFixed(2)} ${info.row.original.currency.toUpperCase()}`,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
]

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge variant="success">{status}</Badge>
  if (status === 'failed') return <Badge variant="danger">{status}</Badge>
  if (status === 'refunded' || status === 'cancelled') return <Badge variant="warning">{status}</Badge>
  return <Badge variant="default">{status}</Badge>
}

export function TransactionTable({ range }: { range: DateRange }) {
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', page, range],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' })
      if (range.dateFrom) params.set('dateFrom', range.dateFrom)
      if (range.dateTo) params.set('dateTo', range.dateTo)
      const res = await fetch(`/api/data/transactions?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load transactions')
      return res.json() as Promise<{ transactions: TransactionRow[]; pagination: { page: number; totalPages: number } }>
    },
  })

  const table = useReactTable({
    data: data?.transactions ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-500">Failed to load transactions.</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
              <span>
                Page {data?.pagination.page ?? 1} of {data?.pagination.totalPages ?? 1}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data || page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
