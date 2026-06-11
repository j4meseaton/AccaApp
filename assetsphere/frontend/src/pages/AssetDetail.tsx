import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight, Monitor, User, Building2, MapPin, Calendar,
  Shield, ExternalLink, Clock,
} from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { StatusPill } from '../components/ui/StatusPill'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AlertBanner } from '../components/ui/AlertBanner'
import { assetsApi } from '../api/assets'
import type { AssetDetail as AssetDetailType, LifecycleStage } from '../types'

const lifecycleStages: { stage: LifecycleStage; label: string }[] = [
  { stage: 'procurement', label: 'Procurement' },
  { stage: 'deployment', label: 'Deployment' },
  { stage: 'active', label: 'Active' },
  { stage: 'maintenance', label: 'Maintenance' },
  { stage: 'decommission', label: 'Decommission' },
  { stage: 'retired', label: 'Retired' },
]

function getStageIndex(stage: LifecycleStage): number {
  return lifecycleStages.findIndex((s) => s.stage === stage)
}

function LifecycleStepper({ currentStage }: { currentStage: LifecycleStage }) {
  const currentIdx = getStageIndex(currentStage)

  return (
    <div className="flex items-center w-full">
      {lifecycleStages.map((s, idx) => {
        const isPast = idx < currentIdx
        const isCurrent = idx === currentIdx
        return (
          <React.Fragment key={s.stage}>
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                  ${isCurrent ? 'bg-accent border-accent text-white'
                    : isPast ? 'bg-success/20 border-success text-success'
                    : 'bg-surface3 border-border-color text-text-muted'
                  }`}
              >
                {isPast ? '✓' : idx + 1}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${isCurrent ? 'text-accent' : isPast ? 'text-success' : 'text-text-muted'}`}
              >
                {s.label}
              </span>
            </div>
            {idx < lifecycleStages.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 rounded transition-colors ${isPast ? 'bg-success' : 'bg-border-color'}`}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const mockAsset: AssetDetailType = {
  id: 'asset-1',
  name: 'LAPTOP-UK-042',
  type: 'laptop',
  status: 'active',
  serial_number: 'SN-2024-042-UK',
  manufacturer: 'Dell',
  model: 'Latitude 5540',
  os: 'Windows 11 Pro',
  os_version: '23H2',
  assigned_to: 'Alice Johnson',
  assigned_to_email: 'alice.johnson@contoso.com',
  department: 'Engineering',
  location: 'London HQ',
  lifecycle_stage: 'active',
  source: 'intune',
  last_seen: new Date(Date.now() - 900_000).toISOString(),
  enrolled_at: '2024-01-15T09:00:00Z',
  purchase_date: '2024-01-10',
  warranty_expiry: '2027-01-10',
  created_at: '2024-01-15T09:00:00Z',
  updated_at: new Date().toISOString(),
  risk_score: 24,
  servicenow_id: 'CI0012345',
  intune_id: 'intune-042',
  nexthink_id: 'nt-042',
  usage_data: {
    cpu_avg_7d: 38,
    memory_avg_7d: 62,
    disk_usage: 71,
    login_count_30d: 22,
    last_user_activity: new Date(Date.now() - 1800_000).toISOString(),
    app_usage: [
      { app_name: 'Microsoft Teams', usage_hours_30d: 84, last_used: new Date().toISOString() },
      { app_name: 'Visual Studio Code', usage_hours_30d: 112, last_used: new Date().toISOString() },
      { app_name: 'Chrome', usage_hours_30d: 64, last_used: new Date().toISOString() },
    ],
  },
  lifecycle_events: [
    { id: 'e1', asset_id: 'asset-1', event_type: 'stage_change', from_stage: 'procurement', to_stage: 'deployment', description: 'Asset deployed to user', performed_by: 'IT Admin', performed_at: '2024-01-15T10:00:00Z' },
    { id: 'e2', asset_id: 'asset-1', event_type: 'stage_change', from_stage: 'deployment', to_stage: 'active', description: 'Asset confirmed active', performed_by: 'IT Admin', performed_at: '2024-01-20T09:00:00Z' },
  ],
  audit_log: [
    { id: 'a1', entity_type: 'asset', entity_id: 'asset-1', action: 'update', performed_by: 'system', performed_at: new Date(Date.now() - 3600_000).toISOString(), changes: { status: { from: 'inactive', to: 'active' } } },
    { id: 'a2', entity_type: 'asset', entity_id: 'asset-1', action: 'sync', performed_by: 'intune-sync', performed_at: new Date(Date.now() - 7200_000).toISOString() },
  ],
  servicenow_tickets: [
    { id: 'sn1', number: 'INC0048291', short_description: 'Screen flickering issue', state: 'In Progress', url: '#', opened_at: '2024-05-01T10:00:00Z' },
  ],
}

export function AssetDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.get(id!),
    enabled: !!id,
    staleTime: 2 * 60_000,
  })

  const a = asset ?? mockAsset

  if (isLoading) {
    return (
      <AppShell title="Asset Detail">
        <div className="max-w-5xl mx-auto space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-surface2 border border-border-color rounded-xl animate-pulse" />
          ))}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title={a.name}>
      <div className="max-w-5xl mx-auto space-y-6">

        <nav className="flex items-center gap-1.5 text-sm text-text-muted">
          <Link to="/inventory" className="hover:text-text-primary transition-colors">Inventory</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-text-primary font-medium">{a.name}</span>
        </nav>

        {error && (
          <AlertBanner variant="warning" message="Could not load live data — showing cached asset." dismissible />
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center">
              <Monitor className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{a.name}</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {a.manufacturer} {a.model} • {a.os} {a.os_version}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={a.status} />
            {a.risk_score !== undefined && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  a.risk_score >= 70 ? 'bg-danger/15 text-danger border-danger/30'
                  : a.risk_score >= 40 ? 'bg-warning/15 text-warning border-warning/30'
                  : 'bg-success/15 text-success border-success/30'
                }`}
              >
                Risk: {a.risk_score}
              </span>
            )}
          </div>
        </div>

        <div className="bg-surface2 border border-border-color rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-secondary mb-4">Lifecycle Stage</h2>
          <LifecycleStepper currentStage={a.lifecycle_stage} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface2 border border-border-color rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-text-primary">Asset Information</h2>
            <dl className="space-y-3">
              {[
                { icon: Monitor, label: 'Serial Number', value: a.serial_number },
                { icon: User, label: 'Assigned To', value: a.assigned_to ?? 'Unassigned' },
                { icon: Building2, label: 'Department', value: a.department },
                { icon: MapPin, label: 'Location', value: a.location },
                { icon: Calendar, label: 'Purchase Date', value: a.purchase_date ? new Date(a.purchase_date).toLocaleDateString('en-GB') : undefined },
                { icon: Shield, label: 'Warranty Expiry', value: a.warranty_expiry ? new Date(a.warranty_expiry).toLocaleDateString('en-GB') : undefined },
                { icon: Clock, label: 'Last Seen', value: a.last_seen ? new Date(a.last_seen).toLocaleString('en-GB') : undefined },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border-color last:border-0">
                  <span className="flex items-center gap-2 text-sm text-text-muted">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </span>
                  <span className="text-sm text-text-primary font-medium">{value ?? '—'}</span>
                </div>
              ))}
            </dl>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-text-muted">Sources:</span>
              <span className="px-2 py-0.5 bg-surface3 text-text-secondary text-xs rounded uppercase">{a.source}</span>
            </div>
          </div>

          <div className="bg-surface2 border border-border-color rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">Usage Data</h2>
              <span className="text-xs text-text-muted bg-surface3 px-2 py-0.5 rounded uppercase">NextThink</span>
            </div>
            {a.usage_data ? (
              <>
                <div className="space-y-3">
                  <ProgressBar label="CPU Usage (7d avg)" value={a.usage_data.cpu_avg_7d} />
                  <ProgressBar label="Memory Usage (7d avg)" value={a.usage_data.memory_avg_7d} />
                  <ProgressBar label="Disk Usage" value={a.usage_data.disk_usage} />
                </div>
                <div className="flex items-center gap-4 text-sm py-2 border-t border-border-color">
                  <div>
                    <p className="text-text-muted text-xs">Logins (30d)</p>
                    <p className="font-semibold text-text-primary">{a.usage_data.login_count_30d}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Last Activity</p>
                    <p className="font-semibold text-text-primary text-xs">
                      {a.usage_data.last_user_activity
                        ? new Date(a.usage_data.last_user_activity).toLocaleString('en-GB')
                        : '—'
                      }
                    </p>
                  </div>
                </div>
                {a.usage_data.app_usage && a.usage_data.app_usage.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Top Apps (30d)</h3>
                    <ul className="space-y-2">
                      {a.usage_data.app_usage.map((app) => (
                        <li key={app.app_name} className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">{app.app_name}</span>
                          <span className="font-medium text-text-primary">{app.usage_hours_30d}h</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-text-muted">No usage data available.</p>
            )}
          </div>
        </div>

        {(a.servicenow_id || (a.servicenow_tickets && a.servicenow_tickets.length > 0)) && (
          <div className="bg-surface2 border border-border-color rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">ServiceNow</h2>
              {a.servicenow_id && (
                <span className="text-xs text-text-muted">CI: {a.servicenow_id}</span>
              )}
            </div>
            {a.servicenow_tickets && a.servicenow_tickets.length > 0 ? (
              <ul className="divide-y divide-border-color">
                {a.servicenow_tickets.map((ticket) => (
                  <li key={ticket.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{ticket.number}</p>
                      <p className="text-xs text-text-secondary">{ticket.short_description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={ticket.state.toLowerCase().replace(/\s/g, '_')} size="sm" />
                      <a
                        href={ticket.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-hover transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No open tickets.</p>
            )}
          </div>
        )}

        {a.audit_log && a.audit_log.length > 0 && (
          <div className="bg-surface2 border border-border-color rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-text-primary">Audit Log</h2>
            <ul className="space-y-2.5">
              {a.audit_log.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-text-primary capitalize">{entry.action}</span>
                    {' '}
                    <span className="text-text-secondary">by <span className="text-accent">{entry.performed_by}</span></span>
                    {entry.changes && Object.entries(entry.changes).map(([field, { from, to }]) => (
                      <span key={field} className="text-text-muted">
                        {' '}• {field}: <span className="line-through">{String(from)}</span> → <span className="text-text-primary">{String(to)}</span>
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap shrink-0">
                    {new Date(entry.performed_at).toLocaleString('en-GB')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  )
}
