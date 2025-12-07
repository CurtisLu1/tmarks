/**
 * 对外 API - 当前用户信息
 * 路径: /api/tab/me
 * 认证: API Key (X-API-Key header)
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../lib/types'
import { success, internalError } from '../../lib/response'
import { requireApiKeyAuth, ApiKeyAuthContext } from '../../middleware/api-key-auth-pages'

// GET /api/me - 获取当前用户信息
type BookmarkStats = {
  total_bookmarks: number | null
  pinned_bookmarks: number | null
  archived_bookmarks: number | null
}

export const onRequestGet: PagesFunction<Env, RouteParams, ApiKeyAuthContext>[] = [
  requireApiKeyAuth('user.read'),
  async (context) => {
    const userId = context.data.user_id

    try {
      // 获取用户信息
      const user = await context.env.DB.prepare(
        'SELECT id, username, email, created_at FROM users WHERE id = ?'
      )
        .bind(userId)
        .first()

      if (!user) {
        return internalError('User not found')
      }

      // 获取统计信息
      const stats = await context.env.DB.prepare(
        `SELECT
          COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as total_bookmarks,
          COUNT(CASE WHEN deleted_at IS NULL AND is_pinned = 1 THEN 1 END) as pinned_bookmarks,
          COUNT(CASE WHEN deleted_at IS NULL AND is_archived = 1 THEN 1 END) as archived_bookmarks
        FROM bookmarks
        WHERE user_id = ?`
      )
        .bind(userId)
        .first<BookmarkStats>()

      const tagCount = await context.env.DB.prepare(
        'SELECT COUNT(*) as count FROM tags WHERE user_id = ? AND deleted_at IS NULL'
      )
        .bind(userId)
        .first<{ count: number }>()

      return success({
        user: {
          ...user,
          stats: {
            total_bookmarks: stats?.total_bookmarks ?? 0,
            pinned_bookmarks: stats?.pinned_bookmarks ?? 0,
            archived_bookmarks: stats?.archived_bookmarks ?? 0,
            total_tags: tagCount?.count || 0,
          },
        },
      })
    } catch (error) {
      console.error('Get user info error:', error)
      return internalError('Failed to get user info')
    }
  },
]
