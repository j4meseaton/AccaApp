import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  RefreshCw,
  Key,
  ShieldCheck,
  Plug,
  BarChart3,
  Settings,
  Users,
  ChevronRight,
  LogOut,
  Box,
} from 'lucide-react'
import { useAuth } from '../../auth/useAuth'

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    ],
  },
  {
    label: 'Assets',
    items: [
      { label: 'Inventory', icon: Package, href: '/inventory' },
      { label: 'Lifecycle', icon: RefreshCw, href: '/lifecycle' },
      { label: 'Licenses', icon: Key, href: '/licenses' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Compliance', icon: ShieldCheck, href: '/compliance' },
      { label: 'Reports', icon: BarChart3, href: '/reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Integrations', icon: Plug, href: '/integrations' },
      { label: 'Users', icon: Users, href: '/users' },
      { label: 'Settings', icon: Settings, href: '/settings' },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <aside
      className={`flex flex-col h-screen bg-surface2 border-r border-border-color transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border-color shrink-0">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shrink-0">
          <Box className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-base text-text-primary tracking-tight">AssetSphere</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href ||
                  (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
                return (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group
                        ${isActive
                          ? 'bg-accent/15 text-accent'
                          : 'text-text-secondary hover:bg-surface3 hover:text-text-primary'
                        }`}
                    >
                      <item.icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'}`} />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User block */}
      <div className="border-t border-border-color p-3 shrink-0">
        {collapsed ? (
          <button
            onClick={() => logout()}
            className="w-full flex justify-center p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0 uppercase">
              {user?.name?.slice(0, 2) ?? user?.username?.slice(0, 2) ?? '??'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">
                {user?.name ?? user?.username ?? 'Unknown User'}
              </p>
              <p className="text-[10px] text-text-muted truncate">
                {user?.username ?? ''}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-6 h-6 rounded-full bg-surface2 border border-border-color flex items-center justify-center text-text-muted hover:text-text-primary transition-colors z-10"
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      )}
    </aside>
  )
}
