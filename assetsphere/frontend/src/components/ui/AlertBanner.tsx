import React, { useState, type ReactNode } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, Info, X } from 'lucide-react'

type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

interface AlertBannerProps {
  variant?: AlertVariant
  title?: string
  message: ReactNode
  dismissible?: boolean
  className?: string
  action?: {
    label: string
    onClick: () => void
  }
}

const variantConfig = {
  info: {
    container: 'bg-info/10 border-info/30 text-info',
    icon: Info,
    iconClass: 'text-info',
  },
  success: {
    container: 'bg-success/10 border-success/30 text-success',
    icon: CheckCircle,
    iconClass: 'text-success',
  },
  warning: {
    container: 'bg-warning/10 border-warning/30 text-warning',
    icon: AlertTriangle,
    iconClass: 'text-warning',
  },
  danger: {
    container: 'bg-danger/10 border-danger/30 text-danger',
    icon: AlertCircle,
    iconClass: 'text-danger',
  },
}

export function AlertBanner({
  variant = 'info',
  title,
  message,
  dismissible = false,
  className = '',
  action,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const { container, icon: Icon, iconClass } = variantConfig[variant]

  return (
    <div className={`flex items-start gap-3 p-4 border rounded-xl ${container} ${className}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold text-sm mb-0.5">{title}</p>
        )}
        <div className="text-sm opacity-90">{message}</div>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
