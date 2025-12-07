import { apiClient } from '@/lib/api-client'
import type {
  Tag,
  TagsResponse,
  CreateTagRequest,
  UpdateTagRequest,
  TagQueryParams,
} from '@/lib/types'

export const tagsService = {
  /**
   * 获取标签列表
   */
  async getTags(params?: TagQueryParams) {
    const searchParams = new URLSearchParams()

    if (params?.sort) searchParams.set('sort', params.sort)

    const query = searchParams.toString()
    const endpoint = query ? `/tags?${query}` : '/tags'

    const response = await apiClient.get<TagsResponse>(endpoint)
    return response.data!
  },

  /**
   * 创建标签
   */
  async createTag(data: CreateTagRequest) {
    const response = await apiClient.post<{ tag: Tag }>('/tags', data)
    return response.data!.tag
  },

  /**
   * 更新标签
   */
  async updateTag(id: string, data: UpdateTagRequest) {
    const response = await apiClient.patch<{ tag: Tag }>(`/tags/${id}`, data)
    return response.data!.tag
  },

  /**
   * 删除标签
   */
  async deleteTag(id: string) {
    await apiClient.delete(`/tags/${id}`)
  },

  /**
   * 增加标签点击计数
   */
  async incrementClick(id: string) {
    await apiClient.patch(`/tags/${id}/click`, {})
  },
}
