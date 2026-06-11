import React from 'react'

interface ProgressBarProps {
  value: number          // 0–100
  label?: string
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'danger'
  animated?: boolean
  className?: string
}

function getAutoVariant(value: number): ProgressBarProps['variant'] {
  if (value >= 90) return 'danger'
  if (value >= 75) return 'warning'
  return 'success'
}

const variantMap = {
  default: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
}

export function ProgressBar({
  value,
  label,
  showValue = true,
  size = 'md',
  variant,
  animated = false,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const resolvedVariant: NonNullable<ProgressBarProps['variant']> = variant ?? getAutoVariant(clamped) ?? 'default'

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-text-primary tabular-nums ml-auto">
              {clamped.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-surface3 rounded-full overflow-hidden ${sizeMap[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${variantMap[resolvedVariant]} ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
