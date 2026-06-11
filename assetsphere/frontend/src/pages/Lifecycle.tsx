import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusPill } from '../components/ui/StatusPill'
import { lifecycleApi, type LifecyclePipelineItem } from '../api/lifecycle'
import type { LifecycleStage, Asset } from '../types'

const stageConfig: Record<LifecycleStage, { label: string; color: string; bg: string; desc: string }> = {
  procurement: { label: 'Procurement', color: 'text-info', bg: 'bg-info/10 border-info/20', desc: 'Ordered / awaiting delivery' },
  deployment: { label: 'Deployment', color: 'text-accent', bg: 'bg-accent/10 border-accent/20', desc: 'Being configured / rolled out' },
  active: { label: 'Active', color: 'text-success', bg: 'bg-success/10 border-success/20', desc: 'In use by assigned user' },
  maintenance: { label: 'Maintenance', color: 'text-warning', bg: 'bg-warning/10 border-warning/20', desc: 'Under repair / maintenance' },
  decommission: { label: 'Decommission', color: 'text-danger', bg: 'bg-danger/10 border-danger/20', desc: 'Pending retirement' },
  retired: { label: 'Retired', color: 'text-text-muted', bg: 'bg-text-muted/10 border-text-muted/20', desc: 'Permanently decommissioned' },
}

const mockStageSummary: Record<LifecycleStage, number> = {
  procurement: 14,
  deployment: 28,
  active: 3541,
  maintenance: 63,
  decommission: 42,
  retired: 154,
}

const mockPipeline: LifecyclePipelineItem[] = Array.from({ length: 12 }, (_, i) => ({
  asset: {
    id: `asset-${i + 100}`,
    name: `LAPTOP-UK-${100 + i}`,
    type: 'laptop',
    status: 'active',
    lifecycle_stage: (['maintenance', 'decommission', 'procurement', 'deployment'] as LifecycleStage[])[i % 4],
    source: 'intune',
    department: ['Engineering', 'Finance', 'HR', 'IT'][i % 4],
    assigned_to: ['Alice Johnson', 'Bob Smith', undefined][i % 3],
    created_at: new Date(2024, 0, i + 1).toISOString(),
    updated_at: new Date().toISOString(),
  } as Asset,
  days_in_stage: Math.floor(Math.random() * 90) + 1,
  recommended_action: ['Review & approve', 'Schedule maintenance', 'Prepare for retirement', 'Deploy to user'][i % 4],
  due_date: new Date(Date.now() + (i * 86_400_000 * 3)).toISOString(),
}))

export function Lifecycle() {
  const navigate = useNavigate()
  const [stageFilter, setStageFilter] = useState<LifecycleStage | ''>('')
  const [page, setPage] = useState(1)

  const { data: stageSummaryData } = useQuery({
    queryKey: ['lifecycle', 'stage-summary'],
    queryFn: () => lifecycleApi.getStageSummary(),
    staleTime: 5 * 60_000,
  })

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['lifecycle', 'pipeline', stageFilter, page],
    queryFn: () => lifecycleApi.getPipeline(stageFilter as LifecycleStage || undefined, page),
    staleTime: 2 * 60_000,
  })

  const stageSummary = stageSummaryData ?? mockStageSummary
  const pipeline = pipelineData?.items ?? mockPipeline
  const total = pipelineData?.total ?? mockPipeline.length

  const columns: Column<LifecyclePipelineItem>[] = [
    {
      key: 'asset',
      header: 'Asset',
      sortable: false,
      render: (row) => (
        <div>
          <p className="font-medium text-text-primary">{row.asset.name}</p>
          <p className="text-xs text-text-muted capitalize">{row.asset.type}</p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      sortable: true,
      render: (row) => <StatusPill status={row.asset.lifecycle_stage} size="sm" />,
    },
    {
      key: 'days_in_stage',
      header: 'Days in Stage',
      sortable: true,
      render: (row) => (
        <span className={`font-medium tabular-nums ${row.days_in_stage > 60 ? 'text-danger' : row.days_in_stage > 30 ? 'text-warning' : 'text-text-primary'}`}>
          {row.days_in_stage}d
          {row.days_in_stage > 60 && <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-danger" />}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row) => <span className="text-text-secondary">{row.asset.department ?? '—'}</span>,
    },
    {
      key: 'assigned_to',
      header: 'Assigned To',
      render: (row) => <span className="text-text-secondary">{row.asset.assigned_to ?? 'Unassigned'}</span>,
    },
    {
      key: 'recommended_action',
      header: 'Action Required',
      render: (row) => row.recommended_action ? (
        <span className="text-xs text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md">
          {row.recommended_action}
        </span>
      ) : null,
    },
    {
      key: 'due_date',
      header: 'Due',
      sortable: true,
      render: (row) => row.due_date ? (
        <span className="text-xs text-text-secondary">
          {new Date(row.due_date).toLocaleDateString('en-GB')}
        </span>
      ) : null,
    },
  ]

  return (
    <AppShell title="Lifecycle">
      <div className="max-w-7xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-text-primary">Lifecycle Management</h1>
          <p className="text-sm text-text-secondary mt-0.5">Track assets through their entire lifecycle from procurement to retirement</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(stageConfig) as LifecycleStage[]).map((stage) => {
            const cfg = stageConfig[stage]
            const count = stageSummary[stage] ?? 0
            const isSelected = stageFilter === stage
            return (
              <button
                key={stage}
                onClick={() => { setStageFilter(isSelected ? '' : stage); setPage(1) }}
                className={`p-3 rounded-xl border text-left transition-all duration-150 hover:scale-[1.02]
                  ${isSelected ? `${cfg.bg} border-opacity-50` : 'bg-surface2 border-border-color hover:border-accent/40'}`}
              >
                <p className={`text-2xl font-bold tabular-nums ${cfg.color}`}>{count.toLocaleString()}</p>
                <p className="text-xs font-medium text-text-secondary mt-0.5">{cfg.label}</p>
                <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{cfg.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="bg-surface2 border border-border-color rounded-xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-4">Lifecycle Flow</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {(Object.keys(stageConfig) as LifecycleStage[]).map((stage, idx) => {
              const cfg = stageConfig[stage]
              const count = stageSummary[stage] ?? 0
              return (
                <React.Fragment key={stage}>
                  <div
                    className={`flex flex-col items-center p-3 rounded-xl border min-w-[100px] ${cfg.bg}`}
                  >
                    <span className={`text-xl font-bold ${cfg.color}`}>{count}</span>
                    <span className={`text-xs font-medium mt-0.5 ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {idx < Object.keys(stageConfig).length - 1 && (
                    <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              Pipeline — Assets Needing Action
              {stageFilter && (
                <span className="ml-2 text-sm font-normal text-text-muted capitalize">({stageFilter})</span>
              )}
            </h2>
            {stageFilter && (
              <button
                onClick={() => setStageFilter('')}
                className="text-xs text-accent hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          <DataTable<LifecyclePipelineItem>
            columns={columns}
            data={pipeline}
            keyExtractor={(row) => row.asset.id}
            onRowClick={(row) => navigate(`/assets/${row.asset.id}`)}
            loading={isLoading}
            emptyMessage="No assets in pipeline."
            pagination={{ page, pageSize: 20, total, onPageChange: setPage }}
          />
        </div>
      </div>
    </AppShell>
  )
}
