/**
 * 快照图片代理 API
 * 路径: /api/snapshot-images/:hash
 * 用于从 R2 读取快照中的图片
 * 
 * 注意: 此 API 通过验证书签所有权来确保安全性
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../lib/types'
import { notFound, internalError } from '../../lib/response'

// OPTIONS /api/snapshot-images/:hash - CORS 预检
export const onRequestOptions: PagesFunction<Env, 'hash'> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// GET /api/snapshot-images/:hash - 获取快照图片
export const onRequestGet: PagesFunction<Env, 'hash'> = async (context) => {
  try {
    const hash = context.params.hash as string
    const bucket = context.env.SNAPSHOTS_BUCKET
    const db = context.env.DB

    if (!bucket || !db) {
      return internalError('Storage not configured')
    }

    // 从 URL 参数获取快照信息
    const url = new URL(context.request.url)
    const userId = url.searchParams.get('u')
    const bookmarkId = url.searchParams.get('b')
    const version = url.searchParams.get('v')

    console.log(`[Snapshot Image API] Request: hash=${hash}, u=${userId}, b=${bookmarkId}, v=${version}`)

    if (!userId || !bookmarkId || !version) {
      console.warn(`[Snapshot Image API] Missing parameters: u=${userId}, b=${bookmarkId}, v=${version}`)
      return new Response('Missing required parameters', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // 验证书签和快照的存在性及所有权
    // 这确保了用户只能访问自己的快照图片
    const snapshot = await db
      .prepare(
        `SELECT s.id 
         FROM bookmark_snapshots s
         JOIN bookmarks b ON s.bookmark_id = b.id
         WHERE s.bookmark_id = ? 
           AND s.user_id = ? 
           AND s.version = ?
           AND b.deleted_at IS NULL`
      )
      .bind(bookmarkId, userId, parseInt(version))
      .first()

    if (!snapshot) {
      console.warn(`[Snapshot Image API] Snapshot not found or access denied: u=${userId}, b=${bookmarkId}, v=${version}, hash=${hash}`)
      return notFound('Snapshot not found or access denied')
    }

    // 构建 R2 键
    let imageKey = `${userId}/${bookmarkId}/v${version}/images/${hash}`

    console.log(`[Snapshot Image API] Fetching: ${imageKey}`)

    // 从 R2 获取图片
    let r2Object = await bucket.get(imageKey)

    // 如果没找到，尝试兼容旧格式（带/不带扩展名）
    if (!r2Object) {
      console.log(`[Snapshot Image API] Not found, trying alternative formats...`)
      
      // 如果 hash 带扩展名，试试去掉
      if (hash.includes('.')) {
        const hashWithoutExt = hash.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '')
        const altKey = `${userId}/${bookmarkId}/v${version}/images/${hashWithoutExt}`
        console.log(`[Snapshot Image API] Trying without extension: ${altKey}`)
        r2Object = await bucket.get(altKey)
        if (r2Object) imageKey = altKey
      } else {
        // 如果 hash 不带扩展名，试试加上常见扩展名
        const extensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif']
        for (const ext of extensions) {
          const altKey = `${userId}/${bookmarkId}/v${version}/images/${hash}${ext}`
          console.log(`[Snapshot Image API] Trying with extension: ${altKey}`)
          r2Object = await bucket.get(altKey)
          if (r2Object) {
            imageKey = altKey
            break
          }
        }
      }
    }

    if (!r2Object) {
      console.warn(`[Snapshot Image API] Image not found in R2 (tried all formats): ${hash}`)
      return new Response('Image not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // 返回图片
    const imageData = await r2Object.arrayBuffer()
    const contentType = r2Object.httpMetadata?.contentType || 'image/jpeg'

    console.log(`[Snapshot Image API] Serving: ${imageKey}, ${(imageData.byteLength / 1024).toFixed(1)}KB, type: ${contentType}`)

    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // 图片永久缓存
        'Access-Control-Allow-Origin': '*', // 允许跨域（因为可能从不同域名访问快照）
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('[Snapshot Image API] Error:', error)
    // 返回明确的错误响应，避免连接关闭
    return new Response('Failed to load image', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
