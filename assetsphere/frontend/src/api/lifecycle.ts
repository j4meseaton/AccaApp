import client from './client'
import type { LifecycleEvent, LifecycleStage, Asset, PaginatedResponse } from '../types'

export interface LifecyclePipelineItem {
  asset: Asset
  days_in_stage: number
  recommended_action?: string
  due_date?: string
}

export const lifecycleApi = {
  getEvents: async (assetId: string): Promise<LifecycleEvent[]> => {
    const { data } = await client.get<LifecycleEvent[]>(`/lifecycle/assets/${assetId}/events`)
    return data
  },

  addEvent: async (assetId: string, payload: Partial<LifecycleEvent>): Promise<LifecycleEvent> => {
    const { data } = await client.post<LifecycleEvent>(`/lifecycle/assets/${assetId}/events`, payload)
    return data
  },

  transitionStage: async (
    assetId: string,
    toStage: LifecycleStage,
    notes?: string
  ): Promise<LifecycleEvent> => {
    const { data } = await client.post<LifecycleEvent>(`/lifecycle/assets/${assetId}/transition`, {
      to_stage: toStage,
      notes,
    })
    return data
  },

  getPipeline: async (
    stage?: LifecycleStage,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<LifecyclePipelineItem>> => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (stage) params.set('stage', stage)
    const { data } = await client.get<PaginatedResponse<LifecyclePipelineItem>>(
      `/lifecycle/pipeline?${params}`
    )
    return data
  },

  getStageSummary: async (): Promise<Record<LifecycleStage, number>> => {
    const { data } = await client.get<Record<LifecycleStage, number>>('/lifecycle/stage-summary')
    return data
  },
}
