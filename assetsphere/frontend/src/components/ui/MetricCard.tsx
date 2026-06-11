import React, { type ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: number
    label?: string
    direction?: 'up' | 'down' | 'neutral'
  }
  accent?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  loading?: boolean
  className?: string
}

const accentMap = {
  default: 'text-accent bg-accent/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  danger: 'text-danger bg-danger/10',
  info: 'text-info bg-info/10',
}

const trendColorMap = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-text-muted',
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = 'default',
  loading = false,
  className = '',
}: MetricCardProps) {
  if (loading) {
    return (
      <div className={`bg-surface2 border border-border-color rounded-xl p-5 animate-pulse ${className}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="h-4 w-24 bg-surface3 rounded" />
          <div className="w-10 h-10 bg-surface3 rounded-lg" />
        </div>
        <div className="h-8 w-20 bg-surface3 rounded mb-2" />
        <div className="h-3 w-32 bg-surface3 rounded" />
      </div>
    )
  }

  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
    ? TrendingDown
    : Minus

  const trendColor = trendColorMap[trend?.direction ?? 'neutral']

  return (
    <div
      className={`bg-surface2 border border-border-color rounded-xl p-5 hover:border-accent/40 transition-colors duration-200 ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
            {icon}
          </div>
        )}
      </div>

      <p className="text-3xl font-bold text-text-primary tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {Math.abs(trend.value)}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-text-muted">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  )
}
