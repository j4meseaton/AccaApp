import React from 'react'
import { RefreshCw, Settings, CheckCircle, AlertTriangle, XCircle, MinusCircle } from 'lucide-react'
import type { IntegrationStatus, IntegrationHealth } from '../../types'
import { StatusPill } from '../ui/StatusPill'

interface IntegrationCardProps {
  integration: IntegrationStatus
  onSync?: (name: string) => void
  onConfigure?: (name: string) => void
  syncing?: boolean
}

const healthIconMap: Record<IntegrationHealth, React.ComponentType<{ className?: string }>> = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  error: XCircle,
  disabled: MinusCircle,
}

const displayNameMap: Record<string, string> = {
  nexthink: 'NextThink',
  servicenow: 'ServiceNow',
  intune: 'Microsoft Intune',
  azure_ad: 'Azure Active Directory',
}

const logoMap: Record<string, string> = {
  nexthink: 'NT',
  servicenow: 'SN',
  intune: 'IN',
  azure_ad: 'AD',
}

const logoColorMap: Record<string, string> = {
  nexthink: 'bg-blue-600',
  servicenow: 'bg-green-600',
  intune: 'bg-indigo-600',
  azure_ad: 'bg-sky-600',
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function IntegrationCard({ integration, onSync, onConfigure, syncing = false }: IntegrationCardProps) {
  const HealthIcon = healthIconMap[integration.health]
  const displayName = displayNameMap[integration.name] ?? integration.display_name
  const logoColor = logoColorMap[integration.name] ?? 'bg-surface3'
  const initials = logoMap[integration.name] ?? integration.name.slice(0, 2).toUpperCase()

  return (
    <div className="bg-surface2 border border-border-color rounded-xl p-5 hover:border-accent/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${logoColor} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
            {initials}
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-sm">{displayName}</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Last sync: {formatRelativeTime(integration.last_sync)}
            </p>
          </div>
        </div>
        <StatusPill status={integration.health} size="sm" />
      </div>

      {/* Error message */}
      {integration.error_message && (
        <div className="mb-3 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
          <p className="text-xs text-danger">{integration.error_message}</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-surface3 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-text-primary tabular-nums">
            {integration.stats.total_records.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">Total</p>
        </div>
        <div className="bg-surface3 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-text-primary tabular-nums">
            {integration.stats.last_synced_count.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">Last Sync</p>
        </div>
        <div className="bg-surface3 rounded-lg p-2.5 text-center">
          <p className={`text-lg font-bold tabular-nums ${integration.stats.errors_last_sync > 0 ? 'text-danger' : 'text-success'}`}>
            {integration.stats.errors_last_sync}
          </p>
          <p className="text-xs text-text-muted">Errors</p>
        </div>
      </div>

      {/* Health indicator */}
      <div className="flex items-center gap-2 mb-4">
        <HealthIcon className={`w-4 h-4 ${integration.health === 'healthy' ? 'text-success' : integration.health === 'degraded' ? 'text-warning' : 'text-danger'}`} />
        <span className="text-xs text-text-secondary">
          {integration.health === 'healthy'
            ? 'All systems operational'
            : integration.health === 'degraded'
            ? 'Partial connectivity issues'
            : integration.health === 'error'
            ? 'Connection failed'
            : 'Integration disabled'}
        </span>
        {integration.stats.uptime_pct !== undefined && (
          <span className="ml-auto text-xs text-text-muted">
            {integration.stats.uptime_pct.toFixed(1)}% uptime
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSync?.(integration.name)}
          disabled={!integration.enabled || syncing}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium rounded-lg border border-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
        <button
          onClick={() => onConfigure?.(integration.name)}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-surface3 hover:bg-border-color text-text-secondary text-sm font-medium rounded-lg border border-border-color transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Configure
        </button>
      </div>
    </div>
  )
}
