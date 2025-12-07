import { apiClient } from '@/lib/api-client'
import type { PreferencesResponse, UpdatePreferencesRequest, UserPreferences } from '@/lib/types'

export const preferencesService = {
  /**
   * 获取用户偏好设置
   */
  async getPreferences(): Promise<UserPreferences> {
    const response = await apiClient.get<PreferencesResponse>('/preferences')
    return response.data!.preferences
  },

  /**
   * 更新用户偏好设置
   */
  async updatePreferences(data: UpdatePreferencesRequest): Promise<UserPreferences> {
    const response = await apiClient.patch<PreferencesResponse>('/preferences', data)
    return response.data!.preferences
  },
}
