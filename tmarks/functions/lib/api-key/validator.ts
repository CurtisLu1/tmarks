/**
 * API Key Validator - 验证和权限检查
 */

import { hashApiKey } from './generator'
import { hasPermission } from '../../../shared/permissions'

interface ApiKeyData {
  id: string
  user_id: string
  permissions: string // JSON string
  status: 'active' | 'revoked' | 'expired'
  expires_at: string | null
  last_used_at: string | null
  last_used_ip: string | null
}

interface ValidationResult {
  valid: boolean
  error?: string
  data?: ApiKeyData
  permissions?: string[]
}

/**
 * 验证 API Key
 * @param apiKey API Key 明文
 * @param db D1 Database
 * @returns 验证结果
 */
export async function validateApiKey(
  apiKey: string,
  db: D1Database
): Promise<ValidationResult> {
  // 1. 格式验证
  if (!apiKey || !apiKey.startsWith('tmk_')) {
    return { valid: false, error: 'Invalid API Key format' }
  }

  try {
    // 2. 计算哈希
    const keyHash = await hashApiKey(apiKey)

    // 3. 查询数据库
    const keyData = await db
      .prepare(
        `SELECT id, user_id, permissions, status, expires_at, last_used_at, last_used_ip
         FROM api_keys
         WHERE key_hash = ?`
      )
      .bind(keyHash)
      .first<ApiKeyData>()

    if (!keyData) {
      return { valid: false, error: 'API Key not found' }
    }

    // 4. 检查状态
    if (keyData.status === 'revoked') {
      return { valid: false, error: 'API Key has been revoked' }
    }

    if (keyData.status === 'expired') {
      return { valid: false, error: 'API Key has expired' }
    }

    // 5. 检查过期时间
    if (keyData.expires_at) {
      const expiresAt = new Date(keyData.expires_at)
      if (expiresAt < new Date()) {
        // 标记为过期
        await markAsExpired(keyData.id, db)
        return { valid: false, error: 'API Key has expired' }
      }
    }

    // 6. 解析权限
    const permissions = JSON.parse(keyData.permissions) as string[]

    return {
      valid: true,
      data: keyData,
      permissions,
    }
  } catch (error) {
    console.error('API Key validation error:', error)
    return { valid: false, error: 'Internal validation error' }
  }
}

/**
 * 检查 API Key 是否有特定权限
 * @param permissions API Key 权限列表
 * @param requiredPermission 需要的权限
 * @returns 是否有权限
 */
export function checkPermission(permissions: string[], requiredPermission: string): boolean {
  return hasPermission(permissions, requiredPermission)
}

/**
 * 标记 API Key 为已过期
 * @param keyId API Key ID
 * @param db D1 Database
 */
async function markAsExpired(keyId: string, db: D1Database): Promise<void> {
  await db
    .prepare(
      `UPDATE api_keys
       SET status = 'expired', updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(keyId)
    .run()
}

/**
 * 更新 API Key 最后使用信息
 * @param keyId API Key ID
 * @param ip 请求 IP
 * @param db D1 Database
 */
export async function updateLastUsed(
  keyId: string,
  ip: string | null,
  db: D1Database
): Promise<void> {
  await db
    .prepare(
      `UPDATE api_keys
       SET last_used_at = datetime('now'),
           last_used_ip = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(ip, keyId)
    .run()
}
