// ─── Asset ────────────────────────────────────────────────────────────────────────────────────

export type AssetStatus = 'active' | 'inactive' | 'retired' | 'lost' | 'stolen' | 'pending'
export type AssetType = 'laptop' | 'desktop' | 'server' | 'mobile' | 'tablet' | 'vm' | 'software' | 'peripheral' | 'other'
export type AssetSource = 'intune' | 'nexthink' | 'servicenow' | 'azure_ad' | 'manual'
export type LifecycleStage = 'procurement' | 'deployment' | 'active' | 'maintenance' | 'decommission' | 'retired'

export interface Asset {
  id: string
  name: string
  type: AssetType
  status: AssetStatus
  serial_number?: string
  manufacturer?: string
  model?: string
  os?: string
  os_version?: string
  assigned_to?: string
  assigned_to_email?: string
  department?: string
  location?: string
  lifecycle_stage: LifecycleStage
  source: AssetSource
  last_seen?: string
  enrolled_at?: string
  purchase_date?: string
  warranty_expiry?: string
  created_at: string
  updated_at: string
  tags?: string[]
  servicenow_id?: string
  intune_id?: string
  nexthink_id?: string
  risk_score?: number
}

export interface AssetDetail extends Asset {
  usage_data?: AssetUsageData
  lifecycle_events?: LifecycleEvent[]
  audit_log?: AuditEntry[]
  servicenow_tickets?: ServiceNowTicket[]
}

export interface AssetUsageData {
  cpu_avg_7d: number
  memory_avg_7d: number
  disk_usage: number
  login_count_30d: number
  last_user_activity?: string
  app_usage?: AppUsage[]
}

export interface AppUsage {
  app_name: string
  usage_hours_30d: number
  last_used?: string
}

export interface ServiceNowTicket {
  id: string
  number: string
  short_description: string
  state: string
  url: string
  opened_at: string
}

// ─── License ───────────────────────────────────────────────────────────────────────────────

export type LicenseType = 'perpetual' | 'subscription' | 'oem' | 'volume' | 'saas' | 'open_source'
export type LicenseStatus = 'active' | 'expired' | 'expiring_soon' | 'over_allocated'

export interface License {
  id: string
  product_name: string
  vendor: string
  license_type: LicenseType
  status: LicenseStatus
  total_seats: number
  assigned_seats: number
  available_seats: number
  utilisation_pct: number
  cost_per_seat?: number
  total_cost?: number
  currency?: string
  purchase_date?: string
  expiry_date?: string
  renewal_date?: string
  contract_number?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface LicenseAssignment {
  id: string
  license_id: string
  user_id: string
  user_name: string
  user_email: string
  asset_id?: string
  assigned_at: string
  assigned_by: string
  active: boolean
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────────────────────

export type LifecycleEventType =
  | 'stage_change'
  | 'maintenance'
  | 'incident'
  | 'repair'
  | 'upgrade'
  | 'reassignment'
  | 'note'

export interface LifecycleEvent {
  id: string
  asset_id: string
  event_type: LifecycleEventType
  from_stage?: LifecycleStage
  to_stage?: LifecycleStage
  description: string
  performed_by: string
  performed_at: string
  metadata?: Record<string, unknown>
}

// ─── User & Roles ───────────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'viewer' | 'auditor'

export interface User {
  id: string
  azure_id: string
  display_name: string
  email: string
  role: UserRole
  department?: string
  job_title?: string
  is_active: boolean
  last_login?: string
  created_at: string
  updated_at: string
  asset_count?: number
}

// ─── Integrations ──────────────────────────────────────────────────────────────────────────

export type IntegrationName = 'nexthink' | 'servicenow' | 'intune' | 'azure_ad'
export type IntegrationHealth = 'healthy' | 'degraded' | 'error' | 'disabled'

export interface IntegrationStatus {
  id: string
  name: IntegrationName
  display_name: string
  health: IntegrationHealth
  last_sync?: string
  next_sync?: string
  sync_interval_minutes: number
  error_message?: string
  stats: IntegrationStats
  config: Record<string, string>
  enabled: boolean
}

export interface IntegrationStats {
  total_records: number
  last_synced_count: number
  errors_last_sync: number
  uptime_pct?: number
}

// ─── Compliance ─────────────────────────────────────────────────────────────────────────────

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'at_risk' | 'unknown'
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface ComplianceSummary {
  total_assets: number
  compliant: number
  non_compliant: number
  at_risk: number
  unknown: number
  compliance_pct: number
  last_evaluated: string
  top_issues: ComplianceIssue[]
  by_category: ComplianceCategory[]
}

export interface ComplianceIssue {
  id: string
  title: string
  description: string
  severity: SeverityLevel
  affected_count: number
  category: string
}

export interface ComplianceCategory {
  category: string
  compliant: number
  non_compliant: number
  at_risk: number
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  total_assets: number
  active_assets: number
  licensed_software: number
  expiring_licenses_30d: number
  non_compliant_assets: number
  assets_by_category: AssetCategoryCount[]
  compliance_breakdown: ComplianceBreakdown[]
  upcoming_renewals: UpcomingRenewal[]
  risk_summary: RiskSummary
  integration_health: IntegrationStatus[]
}

export interface AssetCategoryCount {
  category: string
  count: number
}

export interface ComplianceBreakdown {
  name: string
  value: number
  color: string
}

export interface UpcomingRenewal {
  id: string
  product_name: string
  vendor: string
  expiry_date: string
  cost?: number
  currency?: string
  days_until_expiry: number
}

export interface RiskSummary {
  critical: number
  high: number
  medium: number
  low: number
}

// ─── Audit ──────────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  performed_by: string
  performed_at: string
  changes?: Record<string, { from: unknown; to: unknown }>
  ip_address?: string
}

// ─── API Pagination ───────────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string[]>
}

// ─── Filters ───────────────────────────────────────────────────────────────────────────────

export interface AssetFilters {
  status?: AssetStatus
  type?: AssetType
  department?: string
  source?: AssetSource
  lifecycle_stage?: LifecycleStage
  search?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface LicenseFilters {
  status?: LicenseStatus
  vendor?: string
  license_type?: LicenseType
  search?: string
  page?: number
  page_size?: number
}
