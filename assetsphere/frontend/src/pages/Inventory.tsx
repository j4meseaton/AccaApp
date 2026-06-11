import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, RefreshCw, Download, SlidersHorizontal, X } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusPill } from '../components/ui/StatusPill'
import { AlertBanner } from '../components/ui/AlertBanner'
import { assetsApi } from '../api/assets'
import type { Asset, AssetStatus, AssetType, AssetSource } from '../types'

const statusOptions: AssetStatus[] = ['active', 'inactive', 'retired', 'lost', 'stolen', 'pending']
const typeOptions: AssetType[] = ['laptop', 'desktop', 'server', 'mobile', 'tablet', 'vm', 'software', 'peripheral', 'other']
const sourceOptions: AssetSource[] = ['intune', 'nexthink', 'servicenow', 'azure_ad', 'manual']

const mockAssets: Asset[] = Array.from({ length: 24 }, (_, i) => ({
  id: `asset-${i + 1}`,
  name: ['LAPTOP-UK-0' + (i + 1), 'DESKTOP-LON-' + (i + 10), 'SRV-PROD-' + (i + 1)][i % 3],
  type: (['laptop', 'desktop', 'server', 'mobile', 'tablet', 'vm'] as AssetType[])[i % 6],
  status: (['active', 'active', 'active', 'inactive', 'pending', 'retired'] as AssetStatus[])[i % 6],
  lifecycle_stage: 'active',
  source: (['intune', 'nexthink', 'servicenow', 'azure_ad'] as AssetSource[])[i % 4],
  assigned_to: ['Alice Johnson', 'Bob Smith', 'Carol White', 'Dave Brown', undefined][i % 5],
  department: ['Engineering', 'Finance', 'HR', 'Sales', 'IT'][i % 5],
  last_seen: new Date(Date.now() - (i * 3_600_000)).toISOString(),
  created_at: new Date(2024, 0, i + 1).toISOString(),
  updated_at: new Date(Date.now() - (i * 3_600_000)).toISOString(),
}))

const columns: Column<Asset>[] = [
  {
    key: 'name',
    header: 'Asset Name',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-text-primary">{row.name}</p>
        {row.serial_number && (
          <p className="text-xs text-text-muted">{row.serial_number}</p>
        )}
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    sortable: true,
    render: (row) => (
      <span className="capitalize text-text-secondary">{row.type}</span>
    ),
  },
  {
    key: 'assigned_to',
    header: 'Assigned To',
    sortable: true,
    render: (row) => row.assigned_to ? (
      <div>
        <p className="text-text-primary">{row.assigned_to}</p>
        {row.assigned_to_email && (
          <p className="text-xs text-text-muted">{row.assigned_to_email}</p>
        )}
      </div>
    ) : <span className="text-text-muted">Unassigned</span>,
  },
  {
    key: 'department',
    header: 'Department',
    sortable: true,
    render: (row) => <span className="text-text-secondary">{row.department ?? '—'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => <StatusPill status={row.status} size="sm" />,
  },
  {
    key: 'last_seen',
    header: 'Last Seen',
    sortable: true,
    render: (row) => row.last_seen ? (
      <span className="text-text-secondary text-xs">
        {new Date(row.last_seen).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </span>
    ) : <span className="text-text-muted">—</span>,
  },
  {
    key: 'source',
    header: 'Source',
    sortable: true,
    render: (row) => (
      <span className="px-2 py-0.5 bg-surface3 text-text-secondary text-xs rounded-md uppercase tracking-wide">
        {row.source}
      </span>
    ),
  },
]

export function Inventory() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<AssetType | ''>('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<AssetSource | ''>('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const pageSize = 20

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['assets', { search, statusFilter, typeFilter, departmentFilter, sourceFilter, page, sortBy, sortOrder }],
    queryFn: () => assetsApi.list({
      search: search || undefined,
      status: (statusFilter as AssetStatus) || undefined,
      type: (typeFilter as AssetType) || undefined,
      department: departmentFilter || undefined,
      source: (sourceFilter as AssetSource) || undefined,
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    staleTime: 2 * 60_000,
  })

  useEffect(() => {
    const urlSearch = searchParams.get('search')
    if (urlSearch) setSearch(urlSearch)
  }, [searchParams])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await assetsApi.sync()
      setSyncSuccess(true)
      void refetch()
      setTimeout(() => setSyncSuccess(false), 3000)
    } catch {
      // handle error
    } finally {
      setSyncing(false)
    }
  }

  const handleExport = async () => {
    try {
      const blob = await assetsApi.export({ search: search || undefined, status: (statusFilter as AssetStatus) || undefined })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `assetsphere-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // handle
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setTypeFilter('')
    setDepartmentFilter('')
    setSourceFilter('')
    setSearchParams({})
    setPage(1)
  }

  const hasFilters = search || statusFilter || typeFilter || departmentFilter || sourceFilter

  const assets = data?.items ?? mockAssets.slice((page - 1) * pageSize, page * pageSize)
  const total = data?.total ?? mockAssets.length

  return (
    <AppShell title="Inventory">
      <div className="max-w-7xl mx-auto space-y-5">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Asset Inventory</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {total.toLocaleString()} assets across all sources
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-surface2 hover:bg-surface3 text-text-secondary text-sm font-medium rounded-lg border border-border-color transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {syncSuccess && (
          <AlertBanner variant="success" message="Sync completed successfully." dismissible />
        )}

        <div className="bg-surface2 border border-border-color rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-surface3 border border-border-color rounded-lg focus-within:border-accent transition-colors">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="text"
                placeholder="Search by name, serial number, user…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
              />
              {search && (
                <button onClick={() => { setSearch(''); setSearchParams({}) }}>
                  <X className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                ${showFilters || hasFilters
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface3 text-text-secondary border-border-color hover:text-text-primary'
                }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasFilters && (
                <span className="w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                  {[statusFilter, typeFilter, departmentFilter, sourceFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-text-muted hover:text-danger transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-border-color">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as AssetStatus | ''); setPage(1) }}
                  className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s} className="capitalize">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value as AssetType | ''); setPage(1) }}
                  className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
                >
                  <option value="">All types</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Department</label>
                <input
                  type="text"
                  placeholder="Filter by dept…"
                  value={departmentFilter}
                  onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1) }}
                  className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent placeholder-text-muted"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => { setSourceFilter(e.target.value as AssetSource | ''); setPage(1) }}
                  className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
                >
                  <option value="">All sources</option>
                  {sourceOptions.map((s) => (
                    <option key={s} value={s} className="uppercase">{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {error && (
          <AlertBanner
            variant="danger"
            title="Failed to load assets"
            message="Could not connect to the API. Showing cached data."
          />
        )}

        <DataTable<Asset>
          columns={columns}
          data={assets}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/assets/${row.id}`)}
          loading={isLoading}
          emptyMessage="No assets match your filters."
          onSort={(key, order) => { setSortBy(key); setSortOrder(order) }}
          defaultSort={{ key: sortBy, order: sortOrder }}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
          }}
        />
      </div>
    </AppShell>
  )
}
