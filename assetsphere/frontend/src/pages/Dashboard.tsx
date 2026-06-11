import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Package, Key, ShieldX, Calendar, TrendingUp } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { MetricCard } from '../components/ui/MetricCard'
import { StatusPill } from '../components/ui/StatusPill'
import { AlertBanner } from '../components/ui/AlertBanner'
import { assetsApi } from '../api/assets'
import { licensesApi } from '../api/licenses'
import type { DashboardMetrics, UpcomingRenewal, IntegrationStatus } from '../types'

const mockMetrics: DashboardMetrics = {
  total_assets: 3842,
  active_assets: 3541,
  licensed_software: 284,
  expiring_licenses_30d: 12,
  non_compliant_assets: 47,
  assets_by_category: [
    { category: 'Laptops', count: 1540 },
    { category: 'Desktops', count: 620 },
    { category: 'Servers', count: 210 },
    { category: 'Mobile', count: 890 },
    { category: 'VMs', count: 350 },
    { category: 'Other', count: 232 },
  ],
  compliance_breakdown: [
    { name: 'Compliant', value: 3510, color: '#22c55e' },
    { name: 'At Risk', value: 285, color: '#f59e0b' },
    { name: 'Non-Compliant', value: 47, color: '#ef4444' },
  ],
  upcoming_renewals: [
    { id: '1', product_name: 'Microsoft 365 E3', vendor: 'Microsoft', expiry_date: '2026-07-01', cost: 48000, currency: 'GBP', days_until_expiry: 21 },
    { id: '2', product_name: 'Adobe Creative Cloud', vendor: 'Adobe', expiry_date: '2026-07-15', cost: 12400, currency: 'GBP', days_until_expiry: 35 },
    { id: '3', product_name: 'Crowdstrike Falcon', vendor: 'CrowdStrike', expiry_date: '2026-08-01', cost: 6200, currency: 'GBP', days_until_expiry: 52 },
    { id: '4', product_name: 'Slack Business+', vendor: 'Salesforce', expiry_date: '2026-08-20', cost: 3800, currency: 'GBP', days_until_expiry: 71 },
  ],
  risk_summary: { critical: 5, high: 18, medium: 63, low: 214 },
  integration_health: [
    {
      id: '1', name: 'nexthink', display_name: 'NextThink', health: 'healthy',
      last_sync: new Date(Date.now() - 1800_000).toISOString(),
      sync_interval_minutes: 60, enabled: true,
      stats: { total_records: 3541, last_synced_count: 24, errors_last_sync: 0, uptime_pct: 99.8 },
      config: {},
    },
    {
      id: '2', name: 'servicenow', display_name: 'ServiceNow', health: 'healthy',
      last_sync: new Date(Date.now() - 3600_000).toISOString(),
      sync_interval_minutes: 120, enabled: true,
      stats: { total_records: 3842, last_synced_count: 12, errors_last_sync: 0, uptime_pct: 99.5 },
      config: {},
    },
    {
      id: '3', name: 'intune', display_name: 'Intune', health: 'degraded',
      last_sync: new Date(Date.now() - 7200_000).toISOString(),
      sync_interval_minutes: 60, enabled: true,
      error_message: 'API rate limit exceeded — retrying in 15 min',
      stats: { total_records: 2140, last_synced_count: 0, errors_last_sync: 3, uptime_pct: 97.2 },
      config: {},
    },
    {
      id: '4', name: 'azure_ad', display_name: 'Azure AD', health: 'healthy',
      last_sync: new Date(Date.now() - 900_000).toISOString(),
      sync_interval_minutes: 30, enabled: true,
      stats: { total_records: 4120, last_synced_count: 8, errors_last_sync: 0, uptime_pct: 100 },
      config: {},
    },
  ],
}

const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: Record<string, number>) => {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-medium" fontSize={11}>
      {(percent * 100).toFixed(0)}%
    </text>
  )
}

function RenewalRow({ renewal }: { renewal: UpcomingRenewal }) {
  const urgency = renewal.days_until_expiry <= 30
    ? 'text-danger'
    : renewal.days_until_expiry <= 60
    ? 'text-warning'
    : 'text-text-secondary'

  return (
    <tr className="border-b border-border-color last:border-0 hover:bg-surface3 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-text-primary">{renewal.product_name}</p>
        <p className="text-xs text-text-muted">{renewal.vendor}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`text-sm font-medium ${urgency}`}>
          {renewal.days_until_expiry}d
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">
        {new Date(renewal.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-4 py-3 text-sm text-text-primary text-right">
        {renewal.cost != null
          ? `${renewal.currency ?? '£'}${renewal.cost.toLocaleString()}`
          : '—'
        }
      </td>
    </tr>
  )
}

function IntegrationHealthRow({ integration }: { integration: IntegrationStatus }) {
  return (
    <tr className="border-b border-border-color last:border-0 hover:bg-surface3 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-text-primary">{integration.display_name}</p>
      </td>
      <td className="px-4 py-3">
        <StatusPill status={integration.health} size="sm" />
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">
        {integration.last_sync
          ? new Date(integration.last_sync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-text-primary tabular-nums">
        {integration.stats.total_records.toLocaleString()}
      </td>
      <td className="px-4 py-3">
        {integration.stats.errors_last_sync > 0 ? (
          <span className="text-xs text-danger font-medium">{integration.stats.errors_last_sync} errors</span>
        ) : (
          <span className="text-xs text-success font-medium">OK</span>
        )}
      </td>
    </tr>
  )
}

export function Dashboard() {
  const navigate = useNavigate()

  const { isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', 'dashboard'],
    queryFn: () => assetsApi.list({ page_size: 1 }),
    staleTime: 5 * 60_000,
  })

  const { isLoading: complianceLoading } = useQuery({
    queryKey: ['compliance-summary'],
    queryFn: () => licensesApi.getComplianceSummary(),
    staleTime: 5 * 60_000,
  })

  const metrics = mockMetrics
  const isLoading = assetsLoading || complianceLoading

  return (
    <AppShell title="Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              View Reports
            </button>
          </div>
        </div>

        {metrics.integration_health.some((i) => i.health !== 'healthy') && (
          <AlertBanner
            variant="warning"
            title="Integration issue detected"
            message="Microsoft Intune is currently experiencing degraded connectivity. Asset data may be out of date."
            dismissible
            action={{ label: 'View Integrations', onClick: () => navigate('/integrations') }}
          />
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Total Assets"
            value={metrics.total_assets}
            subtitle={`${metrics.active_assets.toLocaleString()} active`}
            icon={<Package className="w-5 h-5" />}
            accent="default"
            loading={isLoading}
          />
          <MetricCard
            title="Licensed Software"
            value={metrics.licensed_software}
            subtitle="Tracked products"
            icon={<Key className="w-5 h-5" />}
            accent="info"
            loading={isLoading}
          />
          <MetricCard
            title="Expiring (30 days)"
            value={metrics.expiring_licenses_30d}
            subtitle="License renewals"
            icon={<Calendar className="w-5 h-5" />}
            accent="warning"
            trend={{ value: 20, direction: 'up', label: 'vs last month' }}
            loading={isLoading}
          />
          <MetricCard
            title="Non-Compliant"
            value={metrics.non_compliant_assets}
            subtitle="Assets flagged"
            icon={<ShieldX className="w-5 h-5" />}
            accent="danger"
            trend={{ value: 8, direction: 'down' }}
            loading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 bg-surface2 border border-border-color rounded-xl p-5">
            <h2 className="text-base font-semibold text-text-primary mb-4">Assets by Category</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.assets_by_category} barSize={32} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <XAxis
                  dataKey="category"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#22263a', border: '1px solid #2e3450', borderRadius: 8, color: '#e2e8f0' }}
                  cursor={{ fill: 'rgba(79,142,247,0.08)' }}
                />
                <Bar dataKey="count" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="xl:col-span-2 bg-surface2 border border-border-color rounded-xl p-5">
            <h2 className="text-base font-semibold text-text-primary mb-4">Compliance Posture</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={metrics.compliance_breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {metrics.compliance_breakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#22263a', border: '1px solid #2e3450', borderRadius: 8, color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 space-y-1.5">
              {metrics.compliance_breakdown.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-text-secondary">{entry.name}</span>
                  </span>
                  <span className="font-medium text-text-primary tabular-nums">
                    {entry.value.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-surface2 border border-border-color rounded-xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-4">Risk Summary</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Critical', count: metrics.risk_summary.critical, color: 'bg-danger/15 text-danger border-danger/20' },
              { label: 'High', count: metrics.risk_summary.high, color: 'bg-warning/15 text-warning border-warning/20' },
              { label: 'Medium', count: metrics.risk_summary.medium, color: 'bg-info/15 text-info border-info/20' },
              { label: 'Low', count: metrics.risk_summary.low, color: 'bg-success/15 text-success border-success/20' },
            ].map((risk) => (
              <div
                key={risk.label}
                className={`flex flex-col items-center py-3 px-4 rounded-xl border ${risk.color}`}
              >
                <span className="text-2xl font-bold tabular-nums">{risk.count}</span>
                <span className="text-xs font-medium mt-1">{risk.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-surface2 border border-border-color rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
              <h2 className="text-base font-semibold text-text-primary">Upcoming Renewals</h2>
              <button
                onClick={() => navigate('/licenses')}
                className="text-xs text-accent hover:underline"
              >
                View all
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface3">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Product</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Due in</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Cost</th>
                </tr>
              </thead>
              <tbody>
                {metrics.upcoming_renewals.map((r) => (
                  <RenewalRow key={r.id} renewal={r} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-surface2 border border-border-color rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
              <h2 className="text-base font-semibold text-text-primary">Integration Health</h2>
              <button
                onClick={() => navigate('/integrations')}
                className="text-xs text-accent hover:underline"
              >
                Manage
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface3">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Integration</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Last Sync</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Records</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Errors</th>
                </tr>
              </thead>
              <tbody>
                {metrics.integration_health.map((i) => (
                  <IntegrationHealthRow key={i.id} integration={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
