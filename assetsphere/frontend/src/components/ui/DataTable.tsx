import React, { useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Column<T = any> {
  key: string
  header: string
  sortable?: boolean
  width?: string
  render?: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
  onSort?: (key: string, order: 'asc' | 'desc') => void
  defaultSort?: { key: string; order: 'asc' | 'desc' }
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T = any>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  loading = false,
  emptyMessage = 'No records found.',
  pagination,
  onSort,
  defaultSort,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string>(defaultSort?.key ?? '')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSort?.order ?? 'asc')

  const handleSort = (key: string) => {
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc'
    setSortKey(key)
    setSortOrder(newOrder)
    onSort?.(key, newOrder)
  }

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted" />
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-accent" />
      : <ChevronDown className="w-3.5 h-3.5 text-accent" />
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="overflow-x-auto rounded-xl border border-border-color">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-color bg-surface3">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap select-none
                    ${col.width ?? ''} ${col.sortable ? 'cursor-pointer hover:text-text-primary' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-surface3 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`bg-surface2 hover:bg-surface3 transition-colors duration-100
                    ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-text-primary whitespace-nowrap"
                    >
                      {col.render
                        ? col.render(row)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        : ((row as any)[col.key] as ReactNode) ?? <span className="text-text-muted">—</span>
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-text-muted">
            Showing{' '}
            <span className="text-text-secondary font-medium">
              {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{' '}
            of <span className="text-text-secondary font-medium">{pagination.total.toLocaleString()}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => pagination.onPageChange(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                    ${pagination.page === page
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface3'
                    }`}
                >
                  {page}
                </button>
              )
            })}

            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
