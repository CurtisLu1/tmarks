/**
 * 书签统计 API
 * 路径: /api/v1/bookmarks/statistics
 * 认证: JWT Token
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../lib/types'
import { success, internalError } from '../../../lib/response'
import { requireAuth, AuthContext } from '../../../middleware/auth'

interface BookmarkStatistics {
  summary: {
    total_bookmarks: number
    total_tags: number
    total_clicks: number
    archived_bookmarks: number
    public_bookmarks: number
  }
  top_bookmarks: Array<{
    id: string
    title: string
    url: string
    click_count: number
    last_clicked_at: string | null
  }>
  top_tags: Array<{
    id: string
    name: string
    color: string | null
    click_count: number
    bookmark_count: number
  }>
  top_domains: Array<{
    domain: string
    count: number
  }>
  // 当前选择的时间范围内，每个书签的点击次数（按点击次数降序）
  bookmark_clicks: Array<{
    id: string
    title: string
    url: string
    click_count: number
  }>
  recent_clicks: Array<{
    id: string
    title: string
    url: string
    last_clicked_at: string
  }>
  trends: {
    bookmarks: Array<{ date: string; count: number }>
    clicks: Array<{ date: string; count: number }>
  }
}

// GET /api/v1/bookmarks/statistics - 获取书签统计数据
export const onRequestGet: PagesFunction<Env, string, AuthContext>[] = [
  requireAuth,
  async (context) => {
    const userId = context.data.user_id
    const url = new URL(context.request.url)
    
    // 获取时间范围参数
    const granularity = url.searchParams.get('granularity') || 'day' // day, week, month, year
    const startDate = url.searchParams.get('start_date') // YYYY-MM-DD
    const endDate = url.searchParams.get('end_date') // YYYY-MM-DD

    try {
      const db = context.env.DB

      // 准备趋势查询的分组条件
      // 6. 创建趋势 - 根据粒度动态分组
      let dateGroupBy = ''
      let dateSelect = ''
      
      switch (granularity) {
        case 'year':
          dateGroupBy = "strftime('%Y', created_at)"
          dateSelect = "strftime('%Y', created_at) as date"
          break
        case 'month':
          dateGroupBy = "strftime('%Y-%m', created_at)"
          dateSelect = "strftime('%Y-%m', created_at) as date"
          break
        case 'week':
          // ISO week: %Y-W%W
          dateGroupBy = "strftime('%Y-W%W', created_at)"
          dateSelect = "strftime('%Y-W%W', created_at) as date"
          break
        case 'day':
        default:
          dateGroupBy = "DATE(created_at)"
          dateSelect = "DATE(created_at) as date"
          break
      }

      // 7. 点击趋势（基于点击事件表 bookmark_click_events） - 根据粒度动态分组
      let clickDateGroupBy = ''
      let clickDateSelect = ''

      switch (granularity) {
        case 'year':
          clickDateGroupBy = "strftime('%Y', clicked_at)"
          clickDateSelect = "strftime('%Y', clicked_at) as date"
          break
        case 'month':
          clickDateGroupBy = "strftime('%Y-%m', clicked_at)"
          clickDateSelect = "strftime('%Y-%m', clicked_at) as date"
          break
        case 'week':
          clickDateGroupBy = "strftime('%Y-W%W', clicked_at)"
          clickDateSelect = "strftime('%Y-W%W', clicked_at) as date"
          break
        case 'day':
        default:
          clickDateGroupBy = "DATE(clicked_at)"
          clickDateSelect = "DATE(clicked_at) as date"
          break
      }

      // 🚀 并行执行所有查询 - 性能优化
      const [
        summary,
        tagCount,
        topBookmarks,
        topTags,
        topDomains,
        recentClicks,
        bookmarkTrends,
        clickTrends,
        bookmarkClickStats,
      ] = await Promise.all([
        // 1. 汇总统计
        db.prepare(
          `SELECT 
            COUNT(*) as total_bookmarks,
            SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active_bookmarks,
            SUM(CASE WHEN is_archived = 1 AND deleted_at IS NULL THEN 1 ELSE 0 END) as archived_bookmarks,
            SUM(CASE WHEN is_public = 1 AND deleted_at IS NULL THEN 1 ELSE 0 END) as public_bookmarks,
            SUM(click_count) as total_clicks
          FROM bookmarks 
          WHERE user_id = ? AND deleted_at IS NULL`
        )
          .bind(userId)
          .first(),

        // 2. 标签计数
        db.prepare(
          `SELECT COUNT(*) as total_tags 
          FROM tags 
          WHERE user_id = ? AND deleted_at IS NULL`
        )
          .bind(userId)
          .first(),

        // 3. 热门书签 Top 10
        db.prepare(
          `SELECT id, title, url, click_count, last_clicked_at
          FROM bookmarks
          WHERE user_id = ? AND deleted_at IS NULL AND click_count > 0
          ORDER BY click_count DESC, last_clicked_at DESC
          LIMIT 10`
        )
          .bind(userId)
          .all(),

        // 4. 热门标签 Top 10（包含书签数量）
        db.prepare(
          `SELECT 
            t.id, 
            t.name, 
            t.color, 
            t.click_count,
            COUNT(DISTINCT bt.bookmark_id) as bookmark_count
          FROM tags t
          LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
          WHERE t.user_id = ? AND t.deleted_at IS NULL
          GROUP BY t.id, t.name, t.color, t.click_count
          ORDER BY t.click_count DESC, bookmark_count DESC
          LIMIT 10`
        )
          .bind(userId)
          .all(),

        // 5. 热门域名 Top 10
        db.prepare(
          `SELECT 
            CASE 
              WHEN url LIKE 'http://%' THEN substr(url, 8, instr(substr(url, 8), '/') - 1)
              WHEN url LIKE 'https://%' THEN substr(url, 9, instr(substr(url, 9), '/') - 1)
              ELSE url
            END as domain,
            COUNT(*) as count
          FROM bookmarks
          WHERE user_id = ? AND deleted_at IS NULL
          GROUP BY domain
          ORDER BY count DESC
          LIMIT 10`
        )
          .bind(userId)
          .all(),

        // 6. 最近点击 Top 10
        db.prepare(
          `SELECT id, title, url, last_clicked_at
          FROM bookmarks
          WHERE user_id = ? AND deleted_at IS NULL AND last_clicked_at IS NOT NULL
          ORDER BY last_clicked_at DESC
          LIMIT 10`
        )
          .bind(userId)
          .all(),

        // 7. 创建趋势
        db.prepare(
          `SELECT 
            ${dateSelect},
            COUNT(*) as count
          FROM bookmarks
          WHERE user_id = ? AND deleted_at IS NULL 
            ${startDate ? `AND DATE(created_at) >= ?` : ''}
            ${endDate ? `AND DATE(created_at) <= ?` : ''}
          GROUP BY ${dateGroupBy}
          ORDER BY date ASC`
        )
          .bind(userId, ...[startDate, endDate].filter(Boolean))
          .all(),

        // 8. 点击趋势（基于 bookmark_click_events）
        db.prepare(
          `SELECT
            ${clickDateSelect},
            COUNT(*) as count
          FROM bookmark_click_events
          WHERE user_id = ?
            ${startDate ? `AND DATE(clicked_at) >= ?` : ''}
            ${endDate ? `AND DATE(clicked_at) <= ?` : ''}
          GROUP BY ${clickDateGroupBy}
          ORDER BY date ASC`
        )
          .bind(userId, ...[startDate, endDate].filter(Boolean))
          .all(),

        // 9. 当前时间范围内每个书签的点击次数
        db.prepare(
          `SELECT
            b.id,
            b.title,
            b.url,
            COUNT(e.id) as click_count
          FROM bookmark_click_events e
          JOIN bookmarks b ON e.bookmark_id = b.id
          WHERE e.user_id = ? AND b.deleted_at IS NULL
            ${startDate ? `AND DATE(e.clicked_at) >= ?` : ''}
            ${endDate ? `AND DATE(e.clicked_at) <= ?` : ''}
          GROUP BY b.id, b.title, b.url
          ORDER BY click_count DESC`
        )
          .bind(userId, ...[startDate, endDate].filter(Boolean))
          .all()
      ])

      const statistics: BookmarkStatistics = {
        summary: {
          total_bookmarks: (summary?.total_bookmarks as number) || 0,
          total_tags: (tagCount?.total_tags as number) || 0,
          total_clicks: (summary?.total_clicks as number) || 0,
          archived_bookmarks: (summary?.archived_bookmarks as number) || 0,
          public_bookmarks: (summary?.public_bookmarks as number) || 0,
        },
        top_bookmarks: (topBookmarks.results || []) as Array<{
          id: string
          title: string
          url: string
          click_count: number
          last_clicked_at: string | null
        }>,
        top_tags: (topTags.results || []) as Array<{
          id: string
          name: string
          color: string | null
          click_count: number
          bookmark_count: number
        }>,
        top_domains: (topDomains.results || []) as Array<{
          domain: string
          count: number
        }>,
        recent_clicks: (recentClicks.results || []) as Array<{
          id: string
          title: string
          url: string
          last_clicked_at: string
        }>,
        bookmark_clicks: (bookmarkClickStats.results || []) as Array<{
          id: string
          title: string
          url: string
          click_count: number
        }>,
        trends: {
          bookmarks: (bookmarkTrends.results || []) as Array<{ date: string; count: number }>,
          clicks: (clickTrends.results || []) as Array<{ date: string; count: number }>,
        },
      }

      return success(statistics)
    } catch (error) {
      console.error('Get bookmark statistics error:', error)
      return internalError('Failed to get statistics')
    }
  },
]
