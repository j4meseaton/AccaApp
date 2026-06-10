import React from 'react'
import type { AssetStatus, LicenseStatus, IntegrationHealth, ComplianceStatus, LifecycleStage } from '../../types'

type StatusVariant = AssetStatus | LicenseStatus | IntegrationHealth | ComplianceStatus | LifecycleStage | string

interface StatusPillProps {
  status: StatusVariant
  size?: 'sm' | 'md'
  className?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Asset status
  active: { label: 'Active', className: 'bg-success/15 text-success border-success/30' },
  inactive: { label: 'Inactive', className: 'bg-text-muted/15 text-text-secondary border-text-muted/30' },
  retired: { label: 'Retired', className: 'bg-text-muted/15 text-text-muted border-text-muted/30' },
  lost: { label: 'Lost', className: 'bg-danger/15 text-danger border-danger/30' },
  stolen: { label: 'Stolen', className: 'bg-danger/15 text-danger border-danger/30' },
  pending: { label: 'Pending', className: 'bg-warning/15 text-warning border-warning/30' },
  // License status
  expired: { label: 'Expired', className: 'bg-danger/15 text-danger border-danger/30' },
  expiring_soon: { label: 'Expiring Soon', className: 'bg-warning/15 text-warning border-warning/30' },
  over_allocated: { label: 'Over-allocated', className: 'bg-danger/15 text-danger border-danger/30' },
  // Integration health
  healthy: { label: 'Healthy', className: 'bg-success/15 text-success border-success/30' },
  degraded: { label: 'Degraded', className: 'bg-warning/15 text-warning border-warning/30' },
  error: { label: 'Error', className: 'bg-danger/15 text-danger border-danger/30' },
  disabled: { label: 'Disabled', className: 'bg-text-muted/15 text-text-muted border-text-muted/30' },
  // Compliance
  compliant: { label: 'Compliant', className: 'bg-success/15 text-success border-success/30' },
  non_compliant: { label: 'Non-compliant', className: 'bg-danger/15 text-danger border-danger/30' },
  at_risk: { label: 'At Risk', className: 'bg-warning/15 text-warning border-warning/30' },
  unknown: { label: 'Unknown', className: 'bg-text-muted/15 text-text-secondary border-text-muted/30' },
  // Lifecycle stages
  procurement: { label: 'Procurement', className: 'bg-info/15 text-info border-info/30' },
  deployment: { label: 'Deployment', className: 'bg-accent/15 text-accent border-accent/30' },
  maintenance: { label: 'Maintenance', className: 'bg-warning/15 text-warning border-warning/30' },
  decommission: { label: 'Decommission', className: 'bg-danger/15 text-danger border-danger/30' },
}

export function StatusPill({ status, size = 'md', className = '' }: StatusPillProps) {
  const config = statusConfig[status] ?? {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    className: 'bg-text-muted/15 text-text-secondary border-text-muted/30',
  }

  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-full whitespace-nowrap
        ${sizeClass} ${config.className} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {config.label}
    </span>
  )
}
