import client from './client'
import type { Asset, AssetDetail, AssetFilters, PaginatedResponse } from '../types'

export const assetsApi = {
  list: async (filters: AssetFilters = {}): Promise<PaginatedResponse<Asset>> => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value))
      }
    })
    const { data } = await client.get<PaginatedResponse<Asset>>(`/assets?${params}`)
    return data
  },

  get: async (id: string): Promise<AssetDetail> => {
    const { data } = await client.get<AssetDetail>(`/assets/${id}`)
    return data
  },

  create: async (payload: Partial<Asset>): Promise<Asset> => {
    const { data } = await client.post<Asset>('/assets', payload)
    return data
  },

  update: async (id: string, payload: Partial<Asset>): Promise<Asset> => {
    const { data } = await client.patch<Asset>(`/assets/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/assets/${id}`)
  },

  sync: async (): Promise<{ synced: number; errors: number }> => {
    const { data } = await client.post('/assets/sync')
    return data
  },

  export: async (filters: AssetFilters = {}): Promise<Blob> => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value))
      }
    })
    const { data } = await client.get(`/assets/export?${params}`, {
      responseType: 'blob',
    })
    return data
  },
}
