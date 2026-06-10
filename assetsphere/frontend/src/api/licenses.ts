import client from './client'
import type { License, LicenseAssignment, LicenseFilters, PaginatedResponse, ComplianceSummary } from '../types'

export const licensesApi = {
  list: async (filters: LicenseFilters = {}): Promise<PaginatedResponse<License>> => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value))
      }
    })
    const { data } = await client.get<PaginatedResponse<License>>(`/licenses?${params}`)
    return data
  },

  get: async (id: string): Promise<License> => {
    const { data } = await client.get<License>(`/licenses/${id}`)
    return data
  },

  create: async (payload: Partial<License>): Promise<License> => {
    const { data } = await client.post<License>('/licenses', payload)
    return data
  },

  update: async (id: string, payload: Partial<License>): Promise<License> => {
    const { data } = await client.patch<License>(`/licenses/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/licenses/${id}`)
  },

  getAssignments: async (licenseId: string): Promise<LicenseAssignment[]> => {
    const { data } = await client.get<LicenseAssignment[]>(`/licenses/${licenseId}/assignments`)
    return data
  },

  assign: async (licenseId: string, userId: string, assetId?: string): Promise<LicenseAssignment> => {
    const { data } = await client.post<LicenseAssignment>(`/licenses/${licenseId}/assignments`, {
      user_id: userId,
      asset_id: assetId,
    })
    return data
  },

  unassign: async (licenseId: string, assignmentId: string): Promise<void> => {
    await client.delete(`/licenses/${licenseId}/assignments/${assignmentId}`)
  },

  getComplianceSummary: async (): Promise<ComplianceSummary> => {
    const { data } = await client.get<ComplianceSummary>('/licenses/compliance-summary')
    return data
  },
}
