import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { IntegrationCard } from '../components/integrations/IntegrationCard'
import { AlertBanner } from '../components/ui/AlertBanner'
import { integrationsApi, type IntegrationConfig } from '../api/integrations'
import type { IntegrationStatus, IntegrationName } from '../types'

const mockIntegrations: IntegrationStatus[] = [
  {
    id: '1', name: 'nexthink', display_name: 'NextThink', health: 'healthy',
    last_sync: new Date(Date.now() - 1800_000).toISOString(),
    next_sync: new Date(Date.now() + 1800_000).toISOString(),
    sync_interval_minutes: 60, enabled: true,
    stats: { total_records: 3541, last_synced_count: 24, errors_last_sync: 0, uptime_pct: 99.8 },
    config: { url: 'https://nexthink.contoso.com', tenant: 'contoso' },
  },
  {
    id: '2', name: 'servicenow', display_name: 'ServiceNow', health: 'healthy',
    last_sync: new Date(Date.now() - 3600_000).toISOString(),
    next_sync: new Date(Date.now() + 3600_000).toISOString(),
    sync_interval_minutes: 120, enabled: true,
    stats: { total_records: 3842, last_synced_count: 12, errors_last_sync: 0, uptime_pct: 99.5 },
    config: { instance: 'contoso.service-now.com' },
  },
  {
    id: '3', name: 'intune', display_name: 'Microsoft Intune', health: 'degraded',
    last_sync: new Date(Date.now() - 7200_000).toISOString(),
    sync_interval_minutes: 60, enabled: true,
    error_message: 'API rate limit exceeded — retrying in 15 minutes',
    stats: { total_records: 2140, last_synced_count: 0, errors_last_sync: 3, uptime_pct: 97.2 },
    config: { tenant_id: import.meta.env.VITE_AZURE_TENANT_ID ?? '' },
  },
  {
    id: '4', name: 'azure_ad', display_name: 'Azure Active Directory', health: 'healthy',
    last_sync: new Date(Date.now() - 900_000).toISOString(),
    next_sync: new Date(Date.now() + 900_000).toISOString(),
    sync_interval_minutes: 30, enabled: true,
    stats: { total_records: 4120, last_synced_count: 8, errors_last_sync: 0, uptime_pct: 100 },
    config: { tenant_id: import.meta.env.VITE_AZURE_TENANT_ID ?? '' },
  },
]

const integrationFields: Record<IntegrationName, { key: string; label: string; placeholder: string; type?: string }[]> = {
  nexthink: [
    { key: 'url', label: 'NextThink URL', placeholder: 'https://your-tenant.nexthink.cloud' },
    { key: 'tenant', label: 'Tenant Name', placeholder: 'your-tenant' },
    { key: 'client_id', label: 'Client ID', placeholder: 'Client ID from NextThink' },
    { key: 'client_secret', label: 'Client Secret', placeholder: '••••••••', type: 'password' },
  ],
  servicenow: [
    { key: 'instance', label: 'Instance URL', placeholder: 'your-instance.service-now.com' },
    { key: 'username', label: 'Username', placeholder: 'service-account-user' },
    { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
  ],
  intune: [
    { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Azure Tenant ID' },
    { key: 'client_id', label: 'App Client ID', placeholder: 'Azure App Registration Client ID' },
    { key: 'client_secret', label: 'Client Secret', placeholder: '••••••••', type: 'password' },
  ],
  azure_ad: [
    { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Azure Tenant ID' },
    { key: 'client_id', label: 'App Client ID', placeholder: 'Azure App Registration Client ID' },
    { key: 'client_secret', label: 'Client Secret', placeholder: '••••••••', type: 'password' },
  ],
}

interface ConfigModalProps {
  integration: IntegrationStatus
  onClose: () => void
  onSave: (name: IntegrationName, config: Record<string, string>) => void
}

function ConfigModal({ integration, onClose, onSave }: ConfigModalProps) {
  const [config, setConfig] = useState<Record<string, string>>(integration.config ?? {})
  const fields = integrationFields[integration.name] ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface2 border border-border-color rounded-2xl shadow-card-hover w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <h2 className="text-base font-semibold text-text-primary">
            Configure {integration.display_name}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{field.label}</label>
              <input
                type={field.type ?? 'text'}
                value={config[field.key] ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent placeholder-text-muted"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <label className="text-sm text-text-secondary">Enabled</label>
            <input type="checkbox" defaultChecked={integration.enabled} className="accent-accent" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border-color">
          <button
            onClick={() => onSave(integration.name, config)}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface3 hover:bg-border-color text-text-secondary text-sm rounded-lg border border-border-color transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function Integrations() {
  const queryClient = useQueryClient()
  const [configTarget, setConfigTarget] = useState<IntegrationStatus | null>(null)
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())
  const [syncResult, setSyncResult] = useState<{ name: string; success: boolean } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.list(),
    staleTime: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ name, payload }: { name: IntegrationName; payload: Partial<IntegrationConfig> }) =>
      integrationsApi.update(name, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  const data = integrations ?? mockIntegrations

  const handleSync = async (name: string) => {
    const integration = data.find((i) => i.name === name)
    if (!integration) return
    setSyncingIds((prev) => new Set(prev).add(name))
    try {
      await integrationsApi.triggerSync(name as IntegrationName)
      setSyncResult({ name, success: true })
      void queryClient.invalidateQueries({ queryKey: ['integrations'] })
    } catch {
      setSyncResult({ name, success: false })
    } finally {
      setSyncingIds((prev) => { const s = new Set(prev); s.delete(name); return s })
      setTimeout(() => setSyncResult(null), 4000)
    }
  }

  const handleSaveConfig = async (name: IntegrationName, config: Record<string, string>) => {
    await updateMutation.mutateAsync({ name, payload: { config } })
    setConfigTarget(null)
  }

  return (
    <AppShell title="Integrations">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Integration Hub</h1>
            <p className="text-sm text-text-secondary mt-0.5">Manage connections to your IT data sources</p>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Integration
          </button>
        </div>

        {syncResult && (
          <AlertBanner
            variant={syncResult.success ? 'success' : 'danger'}
            message={syncResult.success
              ? `${syncResult.name} sync triggered successfully.`
              : `Failed to trigger ${syncResult.name} sync. Check configuration.`
            }
            dismissible
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-5">
          {data.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onSync={handleSync}
              onConfigure={(name) => {
                const target = data.find((i) => i.name === name)
                if (target) setConfigTarget(target)
              }}
              syncing={syncingIds.has(integration.name)}
            />
          ))}
        </div>

        {showAddForm && (
          <div className="bg-surface2 border border-border-color rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-text-primary">Add New Integration</h2>
            <p className="text-sm text-text-secondary">
              Configure a new data source integration. Supported providers: NextThink, ServiceNow, Microsoft Intune, Azure Active Directory.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Integration Type</label>
                <select className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent">
                  <option value="">Select provider…</option>
                  <option value="nexthink">NextThink</option>
                  <option value="servicenow">ServiceNow</option>
                  <option value="intune">Microsoft Intune</option>
                  <option value="azure_ad">Azure Active Directory</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Sync Interval</label>
                <select className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent">
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                  <option value="120">Every 2 hours</option>
                  <option value="1440">Daily</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
                <Save className="w-4 h-4" />
                Add Integration
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-surface3 hover:bg-border-color text-text-secondary text-sm rounded-lg border border-border-color transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {configTarget && (
          <ConfigModal
            integration={configTarget}
            onClose={() => setConfigTarget(null)}
            onSave={handleSaveConfig}
          />
        )}
      </div>
    </AppShell>
  )
}
