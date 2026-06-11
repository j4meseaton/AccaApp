import React, { useState } from 'react'
import { Search, UserPlus, Shield, MoreVertical } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusPill } from '../components/ui/StatusPill'
import type { User, UserRole } from '../types'

const mockUsers: User[] = Array.from({ length: 14 }, (_, i) => ({
  id: `user-${i + 1}`,
  azure_id: `azure-${i + 1}`,
  display_name: ['Alice Johnson', 'Bob Smith', 'Carol White', 'Dave Brown', 'Eve Davis', 'Frank Lee', 'Grace Kim', 'Hank Wilson'][i % 8],
  email: `user${i + 1}@contoso.com`,
  role: (['admin', 'manager', 'viewer', 'viewer', 'auditor', 'viewer', 'manager', 'viewer'] as UserRole[])[i % 8],
  department: ['Engineering', 'Finance', 'HR', 'IT', 'Sales'][i % 5],
  job_title: ['Senior Engineer', 'Finance Manager', 'HR Analyst', 'IT Admin', 'Sales Executive'][i % 5],
  is_active: i % 7 !== 6,
  last_login: new Date(Date.now() - (i * 86_400_000 * 2)).toISOString(),
  created_at: new Date(2024, 0, i + 1).toISOString(),
  updated_at: new Date().toISOString(),
  asset_count: Math.floor(Math.random() * 5) + 1,
}))

const roleColors: Record<UserRole, string> = {
  admin: 'text-danger bg-danger/10 border-danger/20',
  manager: 'text-accent bg-accent/10 border-accent/20',
  viewer: 'text-text-secondary bg-surface3 border-border-color',
  auditor: 'text-warning bg-warning/10 border-warning/20',
}

const rolePermissions: Record<UserRole, string[]> = {
  admin: ['Full access', 'Manage users', 'Manage integrations', 'Export data'],
  manager: ['View all assets', 'Manage assigned assets', 'View reports', 'Export data'],
  viewer: ['View assets', 'View licenses', 'View compliance'],
  auditor: ['View all data', 'View audit logs', 'Export reports'],
}

const columns: Column<User>[] = [
  {
    key: 'display_name',
    header: 'User',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold uppercase shrink-0">
          {row.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p className="font-medium text-text-primary">{row.display_name}</p>
          <p className="text-xs text-text-muted">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    sortable: true,
    render: (row) => (
      <span className={`px-2.5 py-0.5 text-xs font-semibold border rounded-full capitalize ${roleColors[row.role]}`}>
        {row.role}
      </span>
    ),
  },
  {
    key: 'department',
    header: 'Department',
    sortable: true,
    render: (row) => <span className="text-text-secondary">{row.department ?? '—'}</span>,
  },
  {
    key: 'job_title',
    header: 'Job Title',
    render: (row) => <span className="text-text-secondary text-xs">{row.job_title ?? '—'}</span>,
  },
  {
    key: 'is_active',
    header: 'Status',
    sortable: true,
    render: (row) => <StatusPill status={row.is_active ? 'active' : 'inactive'} size="sm" />,
  },
  {
    key: 'asset_count',
    header: 'Assets',
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium text-text-primary tabular-nums">{row.asset_count ?? 0}</span>
    ),
  },
  {
    key: 'last_login',
    header: 'Last Login',
    sortable: true,
    render: (row) => row.last_login ? (
      <span className="text-xs text-text-secondary">
        {new Date(row.last_login).toLocaleDateString('en-GB')}
      </span>
    ) : <span className="text-text-muted">Never</span>,
  },
  {
    key: 'actions',
    header: '',
    render: (_row) => (
      <button className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface3 transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
    ),
  },
]

export function Users() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [page, setPage] = useState(1)
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

  const filteredUsers = mockUsers.filter((u) => {
    if (search && !u.display_name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter && u.role !== roleFilter) return false
    return true
  })

  return (
    <AppShell title="Users">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
            <p className="text-sm text-text-secondary mt-0.5">Manage team members and their access roles</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(roleColors) as UserRole[]).map((role) => {
            const count = mockUsers.filter((u) => u.role === role).length
            const isSelected = selectedRole === role
            return (
              <button
                key={role}
                onClick={() => { setSelectedRole(isSelected ? null : role); setRoleFilter(isSelected ? '' : role) }}
                className={`p-3 rounded-xl border text-left transition-colors hover:border-accent/40
                  ${isSelected ? 'bg-accent/10 border-accent/30' : 'bg-surface2 border-border-color'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className={`w-3.5 h-3.5 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider capitalize">{role}</span>
                </div>
                <p className="text-2xl font-bold text-text-primary">{count}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {rolePermissions[role].slice(0, 2).map((perm) => (
                    <li key={perm} className="text-xs text-text-muted leading-tight">{perm}</li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-xs flex items-center gap-2 px-3 py-2 bg-surface2 border border-border-color rounded-lg focus-within:border-accent transition-colors">
            <Search className="w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            className="bg-surface2 border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>

        <DataTable<User>
          columns={columns}
          data={filteredUsers}
          keyExtractor={(row) => row.id}
          loading={false}
          emptyMessage="No users found."
          pagination={{
            page,
            pageSize: 20,
            total: filteredUsers.length,
            onPageChange: setPage,
          }}
        />
      </div>
    </AppShell>
  )
}
