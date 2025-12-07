/**
 * 对外 API - 标签管理
 * 路径: /api/tab/tags
 * 认证: API Key (X-API-Key header)
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../../lib/types'
import { success, badRequest, created, internalError } from '../../../lib/response'
import { requireApiKeyAuth, ApiKeyAuthContext } from '../../../middleware/api-key-auth-pages'
import { sanitizeString } from '../../../lib/validation'
import { generateUUID } from '../../../lib/crypto'

interface CreateTagRequest {
  name: string
  color?: string
}

interface TagWithCount {
  id: string
  name: string
  color: string | null
  bookmark_count: number
  created_at: string
  updated_at: string
}

// GET /api/tags - 获取标签列表
export const onRequestGet: PagesFunction<Env, RouteParams, ApiKeyAuthContext>[] = [
  requireApiKeyAuth('tags.read'),
  async (context) => {
    const userId = context.data.user_id

    try {
      const { results: tags } = await context.env.DB.prepare(
        `SELECT
          t.id,
          t.name,
          t.color,
          t.created_at,
          t.updated_at,
          COUNT(bt.bookmark_id) as bookmark_count
        FROM tags t
        LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id AND bt.user_id = t.user_id
        LEFT JOIN bookmarks b ON bt.bookmark_id = b.id AND b.deleted_at IS NULL
        WHERE t.user_id = ? AND t.deleted_at IS NULL
        GROUP BY t.id
        ORDER BY t.name ASC`
      )
        .bind(userId)
        .all<TagWithCount>()

      return success({ tags: tags || [] })
    } catch (error) {
      console.error('Get tags error:', error)
      return internalError('Failed to get tags')
    }
  },
]

// POST /api/tags - 创建标签
export const onRequestPost: PagesFunction<Env, RouteParams, ApiKeyAuthContext>[] = [
  requireApiKeyAuth('tags.create'),
  async (context) => {
    const userId = context.data.user_id

    try {
      const body = (await context.request.json()) as CreateTagRequest

      if (!body.name || !body.name.trim()) {
        return badRequest('Tag name is required')
      }

      const name = sanitizeString(body.name, 50)
      const color = body.color ? sanitizeString(body.color, 20) : null

      // 检查标签是否已存在
      const existing = await context.env.DB.prepare(
        'SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL'
      )
        .bind(userId, name)
        .first()

      if (existing) {
        return badRequest('Tag with this name already exists')
      }

      const now = new Date().toISOString()
      const tagId = generateUUID()

      await context.env.DB.prepare(
        `INSERT INTO tags (id, user_id, name, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(tagId, userId, name, color, now, now)
        .run()

      const tag = await context.env.DB.prepare('SELECT * FROM tags WHERE id = ?')
        .bind(tagId)
        .first()

      return created({ tag })
    } catch (error) {
      console.error('Create tag error:', error)
      return internalError('Failed to create tag')
    }
  },
]
