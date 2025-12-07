export interface JWTPayload {
  sub: string // user_id
  exp: number
  iat: number
  session_id?: string
}

/**
 * 生成 JWT
 */
export async function generateJWT(
  payload: Omit<JWTPayload, 'exp' | 'iat'>,
  secret: string,
  expiresIn: string = '30d'
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + parseExpiry(expiresIn)

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp,
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))

  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret)

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

/**
 * 验证并解析 JWT
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [encodedHeader, encodedPayload, signature] = parts

  // 验证签名
  const expectedSignature = await sign(`${encodedHeader}.${encodedPayload}`, secret)
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature')
  }

  // 解析 payload
  const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload))

  // 检查过期
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    throw new Error('Token expired')
  }

  return payload
}

/**
 * 从请求头中提取 JWT
 */
export function extractJWT(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * 使用 Web Crypto API 签名
 */
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const dataBuffer = encoder.encode(data)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, dataBuffer)
  return base64UrlEncode(signature)
}

/**
 * Base64 URL 编码
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string

  if (typeof data === 'string') {
    base64 = btoa(data)
  } else {
    const bytes = new Uint8Array(data)
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    base64 = btoa(binary)
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Base64 URL 解码
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return atob(base64)
}

/**
 * 解析过期时间字符串 (如 "15m", "7d")
 */
export function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error('Invalid expiry format')
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 's':
      return value
    case 'm':
      return value * 60
    case 'h':
      return value * 60 * 60
    case 'd':
      return value * 24 * 60 * 60
    default:
      throw new Error('Invalid expiry unit')
  }
}
