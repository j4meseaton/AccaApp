import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Menu, X, RefreshCw } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'

interface TopbarProps {
  onMenuToggle?: () => void
  title?: string
}

interface Notification {
  id: string
  message: string
  time: string
  read: boolean
  type: 'info' | 'warning' | 'danger'
}

// Mock notifications — in real app these come from an API
const mockNotifications: Notification[] = [
  { id: '1', message: '3 licenses expiring within 30 days', time: '2h ago', read: false, type: 'warning' },
  { id: '2', message: 'NextThink sync completed: 1,204 assets', time: '4h ago', read: false, type: 'info' },
  { id: '3', message: '7 assets are non-compliant', time: '1d ago', read: true, type: 'danger' },
]


export function Topbar({ onMenuToggle, title }: TopbarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState(mockNotifications)

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      navigate(`/inventory?search=${encodeURIComponent(searchValue.trim())}`)
      setSearchValue('')
    }
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <header className="h-16 bg-surface2 border-b border-border-color flex items-center gap-4 px-4 shrink-0 sticky top-0 z-20">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface3 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title — mobile */}
      {title && (
        <h1 className="lg:hidden font-semibold text-text-primary truncate">{title}</h1>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div
          className={`flex items-center gap-2 px-3 py-2 bg-surface3 border rounded-lg transition-all duration-200
            ${searchFocused ? 'border-accent' : 'border-border-color'}`}
        >
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search assets, licenses, users…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
          />
          {searchValue && (
            <button type="button" onClick={() => setSearchValue('')}>
              <X className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors" />
            </button>
          )}
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Sync status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg">
          <RefreshCw className="w-3 h-3 text-success" />
          <span className="text-xs text-success font-medium">Synced</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface3 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowNotifs(false)}
              />
              <div className="absolute right-0 top-12 w-80 bg-surface2 border border-border-color rounded-xl shadow-card-hover z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
                  <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                  <button
                    onClick={markAllRead}
                    className="text-xs text-accent hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <ul className="divide-y divide-border-color max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 text-sm ${n.read ? '' : 'bg-accent/5'}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-block w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-text-muted' : 'bg-accent'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${n.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                            {n.message}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold uppercase">
          {user?.name?.slice(0, 2) ?? user?.username?.slice(0, 2) ?? '??'}
        </div>
      </div>
    </header>
  )
}
