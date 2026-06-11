import React, { useState } from 'react'
import { BarChart3, Download, Calendar, Shield, Key, RefreshCw } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'

interface Report {
  id: string
  title: string
  description: string
  category: 'assets' | 'licenses' | 'compliance' | 'lifecycle'
  icon: React.ComponentType<{ className?: string }>
  last_generated?: string
  format: string[]
}

const reports: Report[] = [
  {
    id: 'r1',
    title: 'Full Asset Inventory',
    description: 'Complete list of all registered assets with status, assignment, and source data.',
    category: 'assets',
    icon: BarChart3,
    last_generated: new Date(Date.now() - 86_400_000).toISOString(),
    format: ['CSV', 'XLSX', 'PDF'],
  },
  {
    id: 'r2',
    title: 'License Utilisation Report',
    description: 'Per-product seat allocation, utilisation percentages, and spend analysis.',
    category: 'licenses',
    icon: Key,
    last_generated: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    format: ['CSV', 'XLSX', 'PDF'],
  },
  {
    id: 'r3',
    title: 'Compliance Summary',
    description: 'Compliance posture by category, top issues, and trend over the last 90 days.',
    category: 'compliance',
    icon: Shield,
    last_generated: new Date(Date.now() - 7_200_000).toISOString(),
    format: ['PDF', 'XLSX'],
  },
  {
    id: 'r4',
    title: 'Licence Expiry Forecast',
    description: 'Upcoming licence renewals in the next 90 days with estimated renewal costs.',
    category: 'licenses',
    icon: Calendar,
    last_generated: undefined,
    format: ['CSV', 'PDF'],
  },
  {
    id: 'r5',
    title: 'Lifecycle Stage Summary',
    description: 'Asset distribution across lifecycle stages with ageing analysis.',
    category: 'lifecycle',
    icon: RefreshCw,
    last_generated: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    format: ['CSV', 'XLSX'],
  },
  {
    id: 'r6',
    title: 'Unused Software Report',
    description: 'Licensed software not detected in use in the last 30 days (via NextThink).',
    category: 'licenses',
    icon: BarChart3,
    last_generated: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    format: ['CSV', 'XLSX', 'PDF'],
  },
]

const categoryColors = {
  assets: 'text-accent bg-accent/10 border-accent/20',
  licenses: 'text-info bg-info/10 border-info/20',
  compliance: 'text-success bg-success/10 border-success/20',
  lifecycle: 'text-warning bg-warning/10 border-warning/20',
}

const categoryLabels = {
  assets: 'Assets',
  licenses: 'Licenses',
  compliance: 'Compliance',
  lifecycle: 'Lifecycle',
}

type ReportCategory = 'all' | Report['category']

export function Reports() {
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory>('all')
  const [generating, setGenerating] = useState<string | null>(null)

  const filtered = categoryFilter === 'all'
    ? reports
    : reports.filter((r) => r.category === categoryFilter)

  const handleGenerate = async (reportId: string) => {
    setGenerating(reportId)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setGenerating(null)
  }

  return (
    <AppShell title="Reports">
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="text-sm text-text-secondary mt-0.5">Generate and download AssetSphere reports</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'assets', 'licenses', 'compliance', 'lifecycle'] as ReportCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize
                ${categoryFilter === cat
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface2 text-text-secondary border-border-color hover:text-text-primary'
                }`}
            >
              {cat === 'all' ? 'All Reports' : categoryLabels[cat]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filtered.map((report) => {
            const Icon = report.icon
            const catColor = categoryColors[report.category]
            const isGenerating = generating === report.id
            return (
              <div
                key={report.id}
                className="bg-surface2 border border-border-color rounded-xl p-5 hover:border-accent/40 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${catColor} shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-text-primary">{report.title}</h3>
                        <p className="text-sm text-text-secondary mt-0.5">{report.description}</p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-0.5 text-xs font-medium border rounded-full capitalize ${catColor}`}>
                        {categoryLabels[report.category]}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      {report.last_generated && (
                        <span className="text-xs text-text-muted">
                          Last run: {new Date(report.last_generated).toLocaleDateString('en-GB')}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {report.format.map((fmt) => (
                          <button
                            key={fmt}
                            className="px-2.5 py-1 text-xs font-medium bg-surface3 text-text-secondary border border-border-color rounded-lg hover:border-accent/40 hover:text-accent transition-colors"
                          >
                            {fmt}
                          </button>
                        ))}
                        <button
                          onClick={() => handleGenerate(report.id)}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ml-1"
                        >
                          {isGenerating ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Generating…
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3" />
                              Generate
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-surface2 border border-border-color rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Scheduled Reports</h2>
            <button className="text-xs text-accent hover:underline">+ Schedule report</button>
          </div>
          <p className="text-sm text-text-secondary">
            No scheduled reports configured. Schedule automatic reports to be delivered to email or Slack on a recurring basis.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
