/**
 * 公开分享访问 API
 * 路径: /api/share/:token
 * 认证: 无需认证（公开访问）
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../lib/types'
import { success, notFound, internalError } from '../../lib/response'

interface ShareRow {
  id: string
  group_id: string
  user_id: string
  share_token: string
  is_public: number
  view_count: number
  created_at: string
  expires_at: string | null
}

interface TabGroupRow {
  id: string
  user_id: string
  title: string
  color: string | null
  tags: string | null
  created_at: string
  updated_at: string
}

interface TabGroupItemRow {
  id: string
  group_id: string
  title: string
  url: string
  favicon: string | null
  position: number
  is_pinned: number
  is_todo: number
  created_at: string
}

// GET /api/share/:token - 获取分享的标签页组
export const onRequestGet: PagesFunction<Env, RouteParams> = async (context) => {
  const shareToken = context.params.token

  try {
    // Get share
    const share = await context.env.DB.prepare(
      'SELECT * FROM shares WHERE share_token = ?'
    )
      .bind(shareToken)
      .first<ShareRow>()

    if (!share) {
      return notFound('Share not found')
    }

    // Check if share is public
    if (share.is_public !== 1) {
      return notFound('Share is private')
    }

    // Check if share has expired
    if (share.expires_at) {
      const expiresAt = new Date(share.expires_at)
      if (expiresAt < new Date()) {
        return notFound('Share has expired')
      }
    }

    // Get tab group
    const groupRow = await context.env.DB.prepare(
      'SELECT * FROM tab_groups WHERE id = ? AND is_deleted = 0'
    )
      .bind(share.group_id)
      .first<TabGroupRow>()

    if (!groupRow) {
      return notFound('Tab group not found')
    }

    // Get tab group items
    const { results: items } = await context.env.DB.prepare(
      'SELECT * FROM tab_group_items WHERE group_id = ? ORDER BY position ASC'
    )
      .bind(share.group_id)
      .all<TabGroupItemRow>()

    // Parse tags
    let tags: string[] | null = null
    if (groupRow.tags) {
      try {
        tags = JSON.parse(groupRow.tags)
      } catch {
        tags = null
      }
    }

    // Increment view count
    await context.env.DB.prepare(
      'UPDATE shares SET view_count = view_count + 1 WHERE id = ?'
    )
      .bind(share.id)
      .run()

    return success({
      tab_group: {
        ...groupRow,
        tags,
        items: items || [],
        item_count: items?.length || 0,
      },
      share_info: {
        view_count: share.view_count + 1,
        created_at: share.created_at,
        expires_at: share.expires_at,
      },
    })
  } catch (error) {
    console.error('Get shared tab group error:', error)
    return internalError('Failed to get shared tab group')
  }
}

