import client from './client'
import type { IntegrationStatus, IntegrationName } from '../types'

export interface IntegrationConfig {
  name: IntegrationName
  config: Record<string, string>
  enabled: boolean
}

export const integrationsApi = {
  list: async (): Promise<IntegrationStatus[]> => {
    const { data } = await client.get<IntegrationStatus[]>('/integrations')
    return data
  },

  get: async (name: IntegrationName): Promise<IntegrationStatus> => {
    const { data } = await client.get<IntegrationStatus>(`/integrations/${name}`)
    return data
  },

  update: async (name: IntegrationName, payload: Partial<IntegrationConfig>): Promise<IntegrationStatus> => {
    const { data } = await client.patch<IntegrationStatus>(`/integrations/${name}`, payload)
    return data
  },

  triggerSync: async (name: IntegrationName): Promise<{ job_id: string; started_at: string }> => {
    const { data } = await client.post(`/integrations/${name}/sync`)
    return data
  },

  getSyncStatus: async (name: IntegrationName, jobId: string): Promise<{
    status: 'running' | 'completed' | 'failed'
    progress?: number
    synced?: number
    errors?: number
    completed_at?: string
  }> => {
    const { data } = await client.get(`/integrations/${name}/sync/${jobId}`)
    return data
  },

  testConnection: async (name: IntegrationName): Promise<{ success: boolean; message: string }> => {
    const { data } = await client.post(`/integrations/${name}/test`)
    return data
  },

  create: async (payload: IntegrationConfig): Promise<IntegrationStatus> => {
    const { data } = await client.post<IntegrationStatus>('/integrations', payload)
    return data
  },
}
