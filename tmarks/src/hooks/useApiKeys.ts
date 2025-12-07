/**
 * API Keys React Query Hooks
 * 使用 React Query 管理 API Keys 数据
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  getApiKeyLogs,
  type UpdateApiKeyRequest,
} from '@/services/api-keys'

// Query Keys
export const apiKeysKeys = {
  all: ['api-keys'] as const,
  lists: () => [...apiKeysKeys.all, 'list'] as const,
  list: () => [...apiKeysKeys.lists()] as const,
  details: () => [...apiKeysKeys.all, 'detail'] as const,
  detail: (id: string) => [...apiKeysKeys.details(), id] as const,
  logs: (id: string) => [...apiKeysKeys.all, 'logs', id] as const,
}

/**
 * 获取 API Keys 列表
 */
export function useApiKeys() {
  return useQuery({
    queryKey: apiKeysKeys.list(),
    queryFn: getApiKeys,
  })
}

/**
 * 获取单个 API Key 详情
 */
export function useApiKey(id: string) {
  return useQuery({
    queryKey: apiKeysKeys.detail(id),
    queryFn: () => getApiKey(id),
    enabled: !!id,
  })
}

/**
 * 获取 API Key 日志
 */
export function useApiKeyLogs(id: string, limit: number = 10) {
  return useQuery({
    queryKey: apiKeysKeys.logs(id),
    queryFn: () => getApiKeyLogs(id, limit),
    enabled: !!id,
  })
}

/**
 * 创建 API Key
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => {
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() })
    },
  })
}

/**
 * 更新 API Key
 */
export function useUpdateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyRequest }) =>
      updateApiKey(id, data),
    onSuccess: (_, variables) => {
      // 刷新列表和详情
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() })
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.detail(variables.id) })
    },
  })
}

/**
 * 撤销 API Key
 */
export function useRevokeApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() })
    },
  })
}

/**
 * 删除 API Key
 */
export function useDeleteApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.lists() })
    },
  })
}
