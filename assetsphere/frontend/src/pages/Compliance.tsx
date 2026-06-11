import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, ShieldX, AlertTriangle, HelpCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { AppShell } from '../components/layout/AppShell'
import { MetricCard } from '../components/ui/MetricCard'
import { AlertBanner } from '../components/ui/AlertBanner'
import { licensesApi } from '../api/licenses'
import type { ComplianceSummary, SeverityLevel } from '../types'

const mockCompliance: ComplianceSummary = {
  total_assets: 3842,
  compliant: 3510,
  non_compliant: 47,
  at_risk: 285,
  unknown: 0,
  compliance_pct: 91.4,
  last_evaluated: new Date(Date.now() - 3_600_000).toISOString(),
  top_issues: [
    { id: 'i1', title: 'Outdated OS', description: 'Assets running Windows 10 versions prior to 22H2', severity: 'high', affected_count: 18, category: 'Operating System' },
    { id: 'i2', title: 'Missing EDR Agent', description: 'CrowdStrike Falcon not detected on these endpoints', severity: 'critical', affected_count: 5, category: 'Security' },
    { id: 'i3', title: 'Unpatched Vulnerabilities', description: 'CVSS score > 8.0 patches pending more than 30 days', severity: 'high', affected_count: 12, category: 'Patch Management' },
    { id: 'i4', title: 'Disk Encryption Disabled', description: 'BitLocker not enabled or key not escrowed', severity: 'medium', affected_count: 9, category: 'Data Protection' },
    { id: 'i5', title: 'Unlicensed Software', description: 'Software detected with no matching license record', severity: 'medium', affected_count: 24, category: 'Software Asset Management' },
    { id: 'i6', title: 'Inactive Accounts', description: 'User accounts not logged in for 90+ days', severity: 'low', affected_count: 31, category: 'Identity' },
  ],
  by_category: [
    { category: 'Security', compliant: 3490, non_compliant: 17, at_risk: 335 },
    { category: 'Patch Mgmt', compliant: 3620, non_compliant: 12, at_risk: 210 },
    { category: 'Data Prot.', compliant: 3780, non_compliant: 9, at_risk: 53 },
    { category: 'SAM', compliant: 3564, non_compliant: 24, at_risk: 254 },
    { category: 'Identity', compliant: 3750, non_compliant: 31, at_risk: 61 },
  ],
}

const severityConfig: Record<SeverityLevel, { color: string; bg: string; label: string }> = {
  critical: { color: 'text-danger', bg: 'bg-danger/10 border-danger/20', label: 'Critical' },
  high: { color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', label: 'High' },
  medium: { color: 'text-warning', bg: 'bg-warning/10 border-warning/20', label: 'Medium' },
  low: { color: 'text-info', bg: 'bg-info/10 border-info/20', label: 'Low' },
  info: { color: 'text-text-secondary', bg: 'bg-surface3 border-border-color', label: 'Info' },
}

export function Compliance() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-summary'],
    queryFn: () => licensesApi.getComplianceSummary(),
    staleTime: 5 * 60_000,
  })

  const compliance = data ?? mockCompliance

  return (
    <AppShell title="Compliance">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Compliance Centre</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Last evaluated: {new Date(compliance.last_evaluated).toLocaleString('en-GB')}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-2xl font-bold ${
            compliance.compliance_pct >= 95 ? 'bg-success/10 border-success/20 text-success'
            : compliance.compliance_pct >= 80 ? 'bg-warning/10 border-warning/20 text-warning'
            : 'bg-danger/10 border-danger/20 text-danger'
          }`}>
            {compliance.compliance_pct.toFixed(1)}%
            <span className="text-sm font-normal text-text-secondary ml-1">compliant</span>
          </div>
        </div>

        {compliance.non_compliant > 0 && (
          <AlertBanner
            variant="danger"
            title={`${compliance.non_compliant} non-compliant assets require attention`}
            message="Review critical and high-severity issues below and take corrective action."
          />
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Compliant"
            value={compliance.compliant}
            subtitle={`${((compliance.compliant / compliance.total_assets) * 100).toFixed(1)}% of fleet`}
            icon={<ShieldCheck className="w-5 h-5" />}
            accent="success"
            loading={isLoading}
          />
          <MetricCard
            title="At Risk"
            value={compliance.at_risk}
            subtitle="Needs remediation"
            icon={<AlertTriangle className="w-5 h-5" />}
            accent="warning"
            loading={isLoading}
          />
          <MetricCard
            title="Non-Compliant"
            value={compliance.non_compliant}
            subtitle="Immediate action"
            icon={<ShieldX className="w-5 h-5" />}
            accent="danger"
            loading={isLoading}
          />
          <MetricCard
            title="Unknown"
            value={compliance.unknown}
            subtitle="No data available"
            icon={<HelpCircle className="w-5 h-5" />}
            accent="default"
            loading={isLoading}
          />
        </div>

        <div className="bg-surface2 border border-border-color rounded-xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-4">Compliance by Category</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={compliance.by_category} barSize={20} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#22263a', border: '1px solid #2e3450', borderRadius: 8, color: '#e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="compliant" name="Compliant" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="at_risk" name="At Risk" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="non_compliant" name="Non-Compliant" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface2 border border-border-color rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-color">
            <h2 className="text-base font-semibold text-text-primary">Top Compliance Issues</h2>
          </div>
          <ul className="divide-y divide-border-color">
            {compliance.top_issues.map((issue) => {
              const sev = severityConfig[issue.severity]
              return (
                <li key={issue.id} className="px-5 py-4 hover:bg-surface3 transition-colors">
                  <div className="flex items-start gap-4">
                    <span className={`mt-0.5 px-2 py-0.5 text-xs font-semibold border rounded-md whitespace-nowrap ${sev.bg} ${sev.color}`}>
                      {sev.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-text-primary text-sm">{issue.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-text-muted">{issue.affected_count} assets</span>
                          <span className="text-xs bg-surface3 text-text-secondary px-2 py-0.5 rounded">
                            {issue.category}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary mt-0.5">{issue.description}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </AppShell>
  )
}
