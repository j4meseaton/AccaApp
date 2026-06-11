import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Key, TrendingUp, AlertTriangle, DollarSign, Search, Plus } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { MetricCard } from '../components/ui/MetricCard'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusPill } from '../components/ui/StatusPill'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AlertBanner } from '../components/ui/AlertBanner'
import { licensesApi } from '../api/licenses'
import type { License, LicenseStatus } from '../types'

const mockLicenses: License[] = [
  { id: 'l1', product_name: 'Microsoft 365 E3', vendor: 'Microsoft', license_type: 'subscription', status: 'active', total_seats: 500, assigned_seats: 487, available_seats: 13, utilisation_pct: 97.4, cost_per_seat: 32, total_cost: 192000, currency: 'GBP', expiry_date: '2026-07-01', renewal_date: '2026-07-01', created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString() },
  { id: 'l2', product_name: 'Adobe Creative Cloud', vendor: 'Adobe', license_type: 'subscription', status: 'expiring_soon', total_seats: 120, assigned_seats: 98, available_seats: 22, utilisation_pct: 81.7, cost_per_seat: 80, total_cost: 115200, currency: 'GBP', expiry_date: '2026-07-15', renewal_date: '2026-07-15', created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString() },
  { id: 'l3', product_name: 'GitHub Enterprise', vendor: 'GitHub', license_type: 'subscription', status: 'over_allocated', total_seats: 150, assigned_seats: 162, available_seats: -12, utilisation_pct: 108, cost_per_seat: 21, total_cost: 40824, currency: 'GBP', expiry_date: '2026-12-31', renewal_date: '2026-12-31', created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString() },
  { id: 'l4', product_name: 'Slack Business+', vendor: 'Salesforce', license_type: 'subscription', status: 'active', total_seats: 400, assigned_seats: 312, available_seats: 88, utilisation_pct: 78, cost_per_seat: 12.5, total_cost: 60000, currency: 'GBP', expiry_date: '2026-08-20', renewal_date: '2026-08-20', created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString() },
  { id: 'l5', product_name: 'Crowdstrike Falcon Pro', vendor: 'CrowdStrike', license_type: 'subscription', status: 'active', total_seats: 600, assigned_seats: 543, available_seats: 57, utilisation_pct: 90.5, cost_per_seat: 15, total_cost: 97200, currency: 'GBP', expiry_date: '2026-08-01', renewal_date: '2026-08-01', created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString() },
  { id: 'l6', product_name: 'Zoom Workplace Pro', vendor: 'Zoom', license_type: 'subscription', status: 'active', total_seats: 300, assigned_seats: 188, available_seats: 112, utilisation_pct: 62.7, cost_per_seat: 16, total_cost: 57600, currency: 'GBP', expiry_date: '2027-01-15', renewal_date: '2027-01-15', created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString() },
  { id: 'l7', product_name: 'Figma Organisation', vendor: 'Figma', license_type: 'subscription', status: 'expired', total_seats: 50, assigned_seats: 48, available_seats: 2, utilisation_pct: 96, cost_per_seat: 45, total_cost: 27000, currency: 'GBP', expiry_date: '2026-05-01', renewal_date: '2026-05-01', created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString() },
]

const columns: Column<License>[] = [
  {
    key: 'product_name',
    header: 'Product',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-text-primary">{row.product_name}</p>
        <p className="text-xs text-text-muted">{row.vendor} • {row.license_type}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => <StatusPill status={row.status} size="sm" />,
  },
  {
    key: 'seats',
    header: 'Seats',
    render: (row) => (
      <span className="text-sm text-text-primary tabular-nums">
        <span className={row.utilisation_pct > 100 ? 'text-danger font-semibold' : ''}>{row.assigned_seats}</span>
        <span className="text-text-muted"> / {row.total_seats}</span>
      </span>
    ),
  },
  {
    key: 'utilisation_pct',
    header: 'Utilisation',
    sortable: true,
    width: 'w-36',
    render: (row) => (
      <div className="w-28">
        <ProgressBar
          value={Math.min(row.utilisation_pct, 100)}
          showValue
          size="sm"
          variant={row.utilisation_pct > 100 ? 'danger' : row.utilisation_pct > 90 ? 'warning' : 'success'}
        />
      </div>
    ),
  },
  {
    key: 'total_cost',
    header: 'Annual Cost',
    sortable: true,
    render: (row) => (
      <span className="text-text-primary font-medium tabular-nums">
        {row.currency ?? '£'}{(row.total_cost ?? 0).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'expiry_date',
    header: 'Expiry',
    sortable: true,
    render: (row) => {
      if (!row.expiry_date) return <span className="text-text-muted">—</span>
      const days = Math.floor((new Date(row.expiry_date).getTime() - Date.now()) / 86_400_000)
      return (
        <div>
          <p className={`text-sm ${days < 0 ? 'text-danger' : days < 30 ? 'text-warning' : 'text-text-secondary'}`}>
            {new Date(row.expiry_date).toLocaleDateString('en-GB')}
          </p>
          {days >= 0 && days < 60 && (
            <p className="text-xs text-warning">{days}d remaining</p>
          )}
          {days < 0 && (
            <p className="text-xs text-danger">Expired {Math.abs(days)}d ago</p>
          )}
        </div>
      )
    },
  },
]

export function Licenses() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LicenseStatus | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['licenses', { search, statusFilter, page }],
    queryFn: () => licensesApi.list({ search: search || undefined, status: statusFilter || undefined, page }),
    staleTime: 2 * 60_000,
  })

  const licenses = data?.items ?? mockLicenses
  const total = data?.total ?? mockLicenses.length

  const totalCost = licenses.reduce((s, l) => s + (l.total_cost ?? 0), 0)
  const overAllocated = licenses.filter((l) => l.utilisation_pct > 100)
  const expiringSoon = licenses.filter((l) => {
    if (!l.expiry_date) return false
    const days = (new Date(l.expiry_date).getTime() - Date.now()) / 86_400_000
    return days >= 0 && days < 30
  })
  const expiredLicenses = licenses.filter((l) => l.status === 'expired')

  return (
    <AppShell title="Licenses">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">License Management</h1>
            <p className="text-sm text-text-secondary mt-0.5">{total} tracked software products</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Add License
          </button>
        </div>

        {overAllocated.length > 0 && (
          <AlertBanner
            variant="danger"
            title={`${overAllocated.length} license${overAllocated.length > 1 ? 's' : ''} over-allocated`}
            message={`You are exceeding purchased seat counts for: ${overAllocated.map((l) => l.product_name).join(', ')}. Purchase additional seats to remain compliant.`}
            action={{ label: 'Review licenses', onClick: () => setStatusFilter('over_allocated') }}
          />
        )}

        {expiredLicenses.length > 0 && (
          <AlertBanner
            variant="warning"
            title={`${expiredLicenses.length} expired license${expiredLicenses.length > 1 ? 's' : ''}`}
            message={`Renew expired licenses to maintain compliance: ${expiredLicenses.map((l) => l.product_name).join(', ')}`}
            dismissible
          />
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Total Products"
            value={total}
            icon={<Key className="w-5 h-5" />}
            accent="default"
          />
          <MetricCard
            title="Annual Spend"
            value={`£${Math.round(totalCost / 1000)}k`}
            subtitle="All active licenses"
            icon={<DollarSign className="w-5 h-5" />}
            accent="info"
          />
          <MetricCard
            title="Expiring (30d)"
            value={expiringSoon.length}
            subtitle="Renewal action needed"
            icon={<AlertTriangle className="w-5 h-5" />}
            accent="warning"
          />
          <MetricCard
            title="Over-Allocated"
            value={overAllocated.length}
            subtitle="Exceeding seat count"
            icon={<TrendingUp className="w-5 h-5" />}
            accent="danger"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-xs flex items-center gap-2 px-3 py-2 bg-surface2 border border-border-color rounded-lg focus-within:border-accent transition-colors">
            <Search className="w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search products or vendors…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as LicenseStatus | ''); setPage(1) }}
            className="bg-surface2 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="over_allocated">Over-allocated</option>
          </select>
          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setPage(1) }}
              className="text-sm text-text-muted hover:text-danger transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <DataTable<License>
          columns={columns}
          data={licenses}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No licenses found."
          pagination={{ page, pageSize: 20, total, onPageChange: setPage }}
          onSort={() => {}}
        />
      </div>
    </AppShell>
  )
}
