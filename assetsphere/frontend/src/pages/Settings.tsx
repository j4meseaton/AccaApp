import React, { useState } from 'react'
import { Save, TestTube, Eye, EyeOff } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { AlertBanner } from '../components/ui/AlertBanner'

type SettingsTab = 'general' | 'authentication' | 'notifications'

interface FieldProps {
  label: string
  id: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  helper?: string
  sensitive?: boolean
}

function FormField({ label, id, type = 'text', value, onChange, placeholder, helper, sensitive = false }: FieldProps) {
  const [showSensitive, setShowSensitive] = useState(false)
  const inputType = sensitive ? (showSensitive ? 'text' : 'password') : type

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent placeholder-text-muted pr-10"
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShowSensitive((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            {showSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {helper && <p className="text-xs text-text-muted mt-1">{helper}</p>}
    </div>
  )
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [saved, setSaved] = useState(false)
  const [tested, setTested] = useState<{ success: boolean; msg: string } | null>(null)

  const [orgName, setOrgName] = useState('Contoso Ltd')
  const [timezone, setTimezone] = useState('Europe/London')
  const [dataRetention, setDataRetention] = useState('365')

  const [tenantId, setTenantId] = useState(import.meta.env.VITE_AZURE_TENANT_ID ?? '')
  const [clientId, setClientId] = useState(import.meta.env.VITE_AZURE_CLIENT_ID ?? '')
  const [clientSecret, setClientSecret] = useState('')

  const [emailEnabled, setEmailEnabled] = useState(true)
  const [slackWebhook, setSlackWebhook] = useState('')
  const [notifyExpiry, setNotifyExpiry] = useState(true)
  const [notifyCompliance, setNotifyCompliance] = useState(true)
  const [notifySync, setNotifySync] = useState(false)

  const handleSave = async () => {
    await new Promise((r) => setTimeout(r, 500))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleTestAzureAD = async () => {
    await new Promise((r) => setTimeout(r, 800))
    setTested({ success: true, msg: 'Successfully authenticated with Azure AD. Tenant verified.' })
    setTimeout(() => setTested(null), 5000)
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'notifications', label: 'Notifications' },
  ]

  return (
    <AppShell title="Settings">
      <div className="max-w-3xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Configure your AssetSphere environment</p>
        </div>

        {saved && <AlertBanner variant="success" message="Settings saved successfully." dismissible />}
        {tested && <AlertBanner variant={tested.success ? 'success' : 'danger'} message={tested.msg} dismissible />}

        <div className="flex gap-1 p-1 bg-surface2 border border-border-color rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-surface2 border border-border-color rounded-xl p-6 space-y-5">

          {activeTab === 'general' && (
            <>
              <h2 className="text-base font-semibold text-text-primary">General Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  id="orgName"
                  label="Organisation Name"
                  value={orgName}
                  onChange={setOrgName}
                  placeholder="Your organisation name"
                />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-surface3 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
                  >
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="America/New_York">America/New_York (ET)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  </select>
                </div>
              </div>
              <FormField
                id="dataRetention"
                label="Data Retention Period (days)"
                type="number"
                value={dataRetention}
                onChange={setDataRetention}
                placeholder="365"
                helper="Asset and audit log data older than this period will be archived."
              />
              <div className="space-y-3 pt-2 border-t border-border-color">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Display</h3>
                {[
                  { label: 'Show risk scores on assets', checked: true },
                  { label: 'Show lifecycle stage in inventory', checked: true },
                  { label: 'Enable advanced compliance rules', checked: false },
                ].map((opt) => (
                  <label key={opt.label} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked={opt.checked} className="accent-accent w-4 h-4" />
                    <span className="text-sm text-text-secondary">{opt.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {activeTab === 'authentication' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">Azure AD SSO Configuration</h2>
                <span className="px-2.5 py-0.5 text-xs bg-success/10 text-success border border-success/20 rounded-full font-medium">Connected</span>
              </div>
              <AlertBanner
                variant="info"
                message="These values are used for both user authentication and integration data access. Changes take effect after a server restart."
              />
              <div className="space-y-4">
                <FormField
                  id="tenantId"
                  label="Azure Tenant ID"
                  value={tenantId}
                  onChange={setTenantId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  helper="Found in Azure Portal → Azure Active Directory → Overview"
                />
                <FormField
                  id="clientId"
                  label="Application (Client) ID"
                  value={clientId}
                  onChange={setClientId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  helper="The App Registration Client ID used for AssetSphere"
                />
                <FormField
                  id="clientSecret"
                  label="Client Secret"
                  value={clientSecret}
                  onChange={setClientSecret}
                  placeholder="Leave blank to keep existing secret"
                  sensitive
                  helper="Client secret from App Registration → Certificates & secrets"
                />
              </div>
              <div className="pt-2 border-t border-border-color">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Redirect URIs</h3>
                <div className="bg-surface3 border border-border-color rounded-lg px-3 py-2.5">
                  <p className="text-sm text-text-primary font-mono">{window.location.origin}</p>
                  <p className="text-xs text-text-muted mt-0.5">Add this URI to your App Registration</p>
                </div>
              </div>
              <button
                onClick={handleTestAzureAD}
                className="flex items-center gap-2 px-4 py-2 bg-surface3 hover:bg-border-color border border-border-color text-text-secondary text-sm font-medium rounded-lg transition-colors"
              >
                <TestTube className="w-4 h-4" />
                Test Connection
              </button>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <h2 className="text-base font-semibold text-text-primary">Notification Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border-color">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Email Notifications</p>
                    <p className="text-xs text-text-muted">Send notifications via email</p>
                  </div>
                  <button
                    onClick={() => setEmailEnabled((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${emailEnabled ? 'bg-accent' : 'bg-surface3 border border-border-color'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${emailEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <FormField
                  id="slackWebhook"
                  label="Slack Webhook URL"
                  value={slackWebhook}
                  onChange={setSlackWebhook}
                  placeholder="https://hooks.slack.com/services/…"
                  helper="Post notifications to a Slack channel"
                />

                <div className="space-y-3 pt-2 border-t border-border-color">
                  <h3 className="text-sm font-semibold text-text-secondary">Notify me when…</h3>
                  {[
                    { label: 'License is expiring within 30 days', state: notifyExpiry, setState: setNotifyExpiry },
                    { label: 'Compliance issues are detected', state: notifyCompliance, setState: setNotifyCompliance },
                    { label: 'Integration sync fails', state: notifySync, setState: setNotifySync },
                  ].map((opt) => (
                    <label key={opt.label} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={opt.state}
                        onChange={(e) => opt.setState(e.target.checked)}
                        className="accent-accent w-4 h-4"
                      />
                      <span className="text-sm text-text-secondary">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="pt-4 border-t border-border-color">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
