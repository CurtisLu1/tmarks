/**
 * API Key Generator - 生成安全的 API Key
 * 格式: tmk_live_[20位随机字符]
 */

/**
 * 生成 API Key
 * @param env 环境变量 ('live' | 'test')
 * @returns API Key, 前缀, SHA256 哈希
 */
export async function generateApiKey(env: 'live' | 'test' = 'live'): Promise<{
  key: string
  prefix: string
  hash: string
}> {
  // Base62 字符集 (a-z, A-Z, 0-9)
  const base62Chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  // 生成 20 位随机字符
  const randomBytes = new Uint8Array(20)
  crypto.getRandomValues(randomBytes)

  const randomStr = Array.from(randomBytes)
    .map(byte => base62Chars[byte % base62Chars.length])
    .join('')

  // 构造完整 Key
  const key = `tmk_${env}_${randomStr}`

  // 生成前缀（用于显示，前 12 位）
  const prefix = key.substring(0, 13) // tmk_live_1a2b

  // 计算 SHA256 哈希
  const hash = await hashApiKey(key)

  return { key, prefix, hash }
}

/**
 * 生成 SHA256 哈希
 * @param key API Key 明文
 * @returns SHA256 哈希 (hex)
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // 转换为 hex 字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * 验证 API Key 格式
 * @param key API Key 字符串
 * @returns 是否有效
 */
export function isValidApiKeyFormat(key: string): boolean {
  // 格式: tmk_(live|test)_[20位base62]
  const pattern = /^tmk_(live|test)_[a-zA-Z0-9]{20}$/
  return pattern.test(key)
}
