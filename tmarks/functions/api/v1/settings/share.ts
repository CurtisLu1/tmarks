import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../../lib/types'
import { requireAuth, AuthContext } from '../../../middleware/auth'
import { success, badRequest, conflict, internalError } from '../../../lib/response'
import { sanitizeString } from '../../../lib/validation'
import { generateSlug } from '../../../lib/utils'
import { invalidatePublicShareCache } from '../../shared/cache'

interface UpdateShareSettingsRequest {
  enabled?: boolean
  slug?: string | null
  title?: string | null
  description?: string | null
  regenerate_slug?: boolean
}

const SLUG_MAX_LENGTH = 64

export const onRequestGet: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  async (context) => {
    const userId = context.data.user_id

    try {
      const record = await context.env.DB.prepare(
        `SELECT public_share_enabled, public_slug, public_page_title, public_page_description
         FROM users
         WHERE id = ?`
      )
        .bind(userId)
        .first<{ public_share_enabled: number; public_slug: string | null; public_page_title: string | null; public_page_description: string | null }>()

      return success({
        share: {
          enabled: Boolean(record?.public_share_enabled),
          slug: record?.public_slug || null,
          title: record?.public_page_title || null,
          description: record?.public_page_description || null,
        },
      })
    } catch (error) {
      console.error('Get share settings error:', error)
      return internalError('Failed to load share settings')
    }
  },
]

export const onRequestPut: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  async (context) => {
    const userId = context.data.user_id

    try {
      const body = (await context.request.json()) as UpdateShareSettingsRequest

      const updates: string[] = []
      const values: Array<string | number | null> = []
      let newSlug: string | null | undefined

      if (body.regenerate_slug) {
        newSlug = await generateUniqueSlug(context.env, userId)
      } else if (body.slug !== undefined) {
        if (body.slug && !/^[a-z0-9-]+$/i.test(body.slug)) {
          return badRequest('Slug can only contain letters, numbers, and hyphen')
        }
        newSlug = body.slug ? sanitizeString(body.slug.toLowerCase(), SLUG_MAX_LENGTH) : null
      }

      if (newSlug !== undefined) {
        if (newSlug) {
          const exist = await context.env.DB.prepare(
            `SELECT id FROM users WHERE LOWER(public_slug) = ? AND id != ?`
          )
            .bind(newSlug.toLowerCase(), userId)
            .first()

          if (exist) {
            return conflict('Slug already in use')
          }
        }
        updates.push('public_slug = ?')
        values.push(newSlug)
      }

      if (body.title !== undefined) {
        updates.push('public_page_title = ?')
        values.push(body.title ? sanitizeString(body.title, 200) : null)
      }

      if (body.description !== undefined) {
        updates.push('public_page_description = ?')
        values.push(body.description ? sanitizeString(body.description, 500) : null)
      }

      if (body.enabled !== undefined) {
        updates.push('public_share_enabled = ?')
        values.push(body.enabled ? 1 : 0)
      }

      if (updates.length === 0) {
        return success({ message: 'No changes applied' })
      }

      updates.push('updated_at = datetime("now")')

      await context.env.DB.prepare(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
      )
        .bind(...values, userId)
        .run()

      await invalidatePublicShareCache(context.env, userId)

      const record = await context.env.DB.prepare(
        `SELECT public_share_enabled, public_slug, public_page_title, public_page_description
         FROM users
         WHERE id = ?`
      )
        .bind(userId)
        .first<{ public_share_enabled: number; public_slug: string | null; public_page_title: string | null; public_page_description: string | null }>()

      return success({
        share: {
          enabled: Boolean(record?.public_share_enabled),
          slug: record?.public_slug || null,
          title: record?.public_page_title || null,
          description: record?.public_page_description || null,
        },
      })
    } catch (error) {
      console.error('Update share settings error:', error)
      return internalError('Failed to update share settings')
    }
  },
]

async function generateUniqueSlug(env: Env, userId: string): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateSlug()
    const existing = await env.DB.prepare(
      `SELECT id FROM users WHERE LOWER(public_slug) = ? AND id != ?`
    )
      .bind(candidate.toLowerCase(), userId)
      .first()

    if (!existing) {
      return candidate
    }
  }
  throw new Error('Failed to generate unique slug')
}
