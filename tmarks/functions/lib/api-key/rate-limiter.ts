/**
 * Rate Limiter - API Key 速率限制
 * 使用 KV 存储请求计数
 */

interface RateLimitConfig {
  per_minute: number
  per_hour: number
  per_day: number
}

const DEFAULT_LIMITS: RateLimitConfig = {
  per_minute: 60,
  per_hour: 1000,
  per_day: 10000,
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp
  retryAfter?: number // 秒
}

/**
 * 检查速率限制
 * @param apiKeyId API Key ID
 * @param kv KV Namespace
 * @param limits 速率限制配置
 * @returns 是否允许请求
 */
export async function checkRateLimit(
  apiKeyId: string,
  kv: KVNamespace,
  limits: RateLimitConfig = DEFAULT_LIMITS
): Promise<RateLimitResult> {
  const now = Date.now()

  // 检查分钟级限制
  const minuteResult = await checkWindow(
    kv,
    apiKeyId,
    'minute',
    60 * 1000,
    limits.per_minute,
    now
  )

  if (!minuteResult.allowed) {
    return minuteResult
  }

  // 检查小时级限制
  const hourResult = await checkWindow(
    kv,
    apiKeyId,
    'hour',
    60 * 60 * 1000,
    limits.per_hour,
    now
  )

  if (!hourResult.allowed) {
    return hourResult
  }

  // 检查天级限制
  const dayResult = await checkWindow(
    kv,
    apiKeyId,
    'day',
    24 * 60 * 60 * 1000,
    limits.per_day,
    now
  )

  return dayResult
}

/**
 * 记录请求（增加计数）
 * @param apiKeyId API Key ID
 * @param kv KV Namespace
 */
export async function recordRequest(apiKeyId: string, kv: KVNamespace): Promise<void> {
  const now = Date.now()

  // 并发增加三个时间窗口的计数
  await Promise.all([
    incrementWindow(kv, apiKeyId, 'minute', 60 * 1000, now),
    incrementWindow(kv, apiKeyId, 'hour', 60 * 60 * 1000, now),
    incrementWindow(kv, apiKeyId, 'day', 24 * 60 * 60 * 1000, now),
  ])
}

/**
 * 检查单个时间窗口
 */
async function checkWindow(
  kv: KVNamespace,
  apiKeyId: string,
  window: 'minute' | 'hour' | 'day',
  windowMs: number,
  limit: number,
  now: number
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / windowMs)
  const key = `ratelimit:${apiKeyId}:${window}:${windowStart}`

  const countStr = await kv.get(key)
  const count = countStr ? parseInt(countStr, 10) : 0

  const allowed = count < limit
  const remaining = Math.max(0, limit - count)
  const reset = (windowStart + 1) * windowMs
  const retryAfter = allowed ? undefined : Math.ceil((reset - now) / 1000)

  return {
    allowed,
    limit,
    remaining,
    reset,
    retryAfter,
  }
}

/**
 * 增加时间窗口计数
 */
async function incrementWindow(
  kv: KVNamespace,
  apiKeyId: string,
  window: 'minute' | 'hour' | 'day',
  windowMs: number,
  now: number
): Promise<void> {
  const windowStart = Math.floor(now / windowMs)
  const key = `ratelimit:${apiKeyId}:${window}:${windowStart}`

  const countStr = await kv.get(key)
  const count = countStr ? parseInt(countStr, 10) : 0

  // TTL 设置为窗口大小 + 1小时（容错）
  const ttl = Math.ceil(windowMs / 1000) + 3600

  await kv.put(key, String(count + 1), { expirationTtl: ttl })
}
