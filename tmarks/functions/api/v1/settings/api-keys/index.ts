/**
 * API Keys 管理端点
 * GET /api/v1/settings/api-keys - 列出所有 API Keys
 * POST /api/v1/settings/api-keys - 创建新的 API Key
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../../../lib/types'
import { success, badRequest, created, internalError } from '../../../../lib/response'
import { requireAuth, AuthContext } from '../../../../middleware/auth'
import { generateApiKey } from '../../../../lib/api-key/generator'
import { PERMISSION_TEMPLATES } from '../../../../../shared/permissions'

interface CreateApiKeyRequest {
  name: string
  description?: string
  permissions?: string[]
  template?: 'READ_ONLY' | 'BASIC' | 'FULL'
  expires_at?: string | null
}

// 获取用户的 API Key 配额限制
async function getUserApiKeyLimit(db: D1Database, userId: string): Promise<number> {
  type DbUser = { role?: string | null }

  let user: DbUser | null = null

  try {
    user = await db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first<DbUser>()
  } catch (error) {
    if (!(error instanceof Error && /no such column: role/i.test(error.message))) {
      throw error
    }
  }

  const role = user?.role ?? 'user'

  // 根据角色返回不同的配额
  // admin: 无限制(用较大的数字表示)
  // user: 3个
  return role === 'admin' ? 999 : 3
}

// GET /api/v1/settings/api-keys - 列出所有 API Keys
interface ApiKeyRow {
  id: string
  key_prefix: string
  name: string
  description: string | null
  permissions: string
  status: string
  expires_at: string | null
  last_used_at: string | null
  last_used_ip: string | null
  created_at: string
  updated_at: string
}

export const onRequestGet: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  async (context) => {
    const userId = context.data.user_id

    try {
      const keys = await context.env.DB.prepare(
        `SELECT id, key_prefix, name, description, permissions, status,
                expires_at, last_used_at, last_used_ip, created_at, updated_at
         FROM api_keys
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
        .bind(userId)
        .all<ApiKeyRow>()

      // 查询配额
      const quota = await context.env.DB.prepare(
        `SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND status = 'active'`
      )
        .bind(userId)
        .first<{ count: number }>()

      const used = quota?.count || 0
      const limit = await getUserApiKeyLimit(context.env.DB, userId)

      return success({
        keys: (keys.results ?? []).map((key) => ({
          ...key,
          permissions: JSON.parse(key.permissions) as string[],
        })),
        quota: {
          used,
          limit,
        },
      })
    } catch (error) {
      console.error('Failed to list API keys:', error)
      return internalError('Failed to list API keys')
    }
  },
]

// POST /api/v1/settings/api-keys - 创建新的 API Key
export const onRequestPost: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  async (context) => {
    const userId = context.data.user_id

    try {
      // 1. 检查配额
      const quota = await context.env.DB.prepare(
        `SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND status = 'active'`
      )
        .bind(userId)
        .first<{ count: number }>()

      const used = quota?.count || 0
      const limit = await getUserApiKeyLimit(context.env.DB, userId)

      if (used >= limit) {
        return badRequest({
          code: 'QUOTA_EXCEEDED',
          message: `Maximum ${limit} API keys allowed per user`,
          quota: { used, limit },
        })
      }

      // 2. 解析请求
      const body = (await context.request.json()) as CreateApiKeyRequest
      const { name, description, permissions, expires_at, template } = body

      if (!name || !name.trim()) {
        return badRequest({
          code: 'INVALID_INPUT',
          message: 'Name is required',
        })
      }

      // 3. 确定权限列表
      let permissionsList: string[] = []

      if (template && PERMISSION_TEMPLATES[template]) {
        // 使用模板
        permissionsList = PERMISSION_TEMPLATES[template].permissions
      } else if (permissions && Array.isArray(permissions)) {
        // 自定义权限
        permissionsList = permissions
      } else {
        // 默认使用基础模板
        permissionsList = PERMISSION_TEMPLATES.BASIC.permissions
      }

      if (permissionsList.length === 0) {
        return badRequest({
          code: 'INVALID_INPUT',
          message: 'At least one permission is required',
        })
      }

      // 4. 验证过期时间
      let expiresAt: string | null = null
      if (expires_at) {
        let expiresDate: Date

        // 支持相对时间格式 (30d, 90d 等) 和 ISO 日期格式
        if (expires_at.match(/^\d+d$/)) {
          const days = parseInt(expires_at.slice(0, -1))
          expiresDate = new Date()
          expiresDate.setDate(expiresDate.getDate() + days)
        } else {
          expiresDate = new Date(expires_at)
        }

        if (expiresDate <= new Date()) {
          return badRequest({
            code: 'INVALID_INPUT',
            message: 'Expiration date must be in the future',
          })
        }
        expiresAt = expiresDate.toISOString()
      }

      // 5. 生成 API Key
      const { key, prefix, hash } = await generateApiKey('live')

      // 6. 生成 UUID
      const keyId = crypto.randomUUID()

      // 7. 保存到数据库
      await context.env.DB.prepare(
        `INSERT INTO api_keys
         (id, user_id, key_hash, key_prefix, name, description, permissions, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      )
        .bind(
          keyId,
          userId,
          hash,
          prefix,
          name.trim(),
          description?.trim() || null,
          JSON.stringify(permissionsList),
          expiresAt
        )
        .run()

      // 8. 返回完整 Key（仅此一次）
      return created({
        id: keyId,
        key, // ⚠️ 完整 Key 仅返回一次
        key_prefix: prefix,
        name: name.trim(),
        description: description?.trim() || null,
        permissions: permissionsList,
        status: 'active',
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to create API key:', error)
      return internalError('Failed to create API key')
    }
  },
]
