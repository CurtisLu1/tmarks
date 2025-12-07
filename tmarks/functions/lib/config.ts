/**
 * 应用配置常量
 * 注意: 所有配置都应该从 Cloudflare 环境变量 (context.env) 中读取
 * 这里只提供默认值,实际值由 wrangler.toml 或 Cloudflare Dashboard 配置
 */

import type { Env } from './types'

/**
 * 默认配置值 (仅在环境变量未设置时使用)
 */
export const DEFAULT_CONFIG = {
  JWT_ACCESS_TOKEN_EXPIRES_IN: '365d',
  JWT_REFRESH_TOKEN_EXPIRES_IN: '365d',
} as const

/**
 * 从环境变量获取 JWT 访问令牌过期时间
 */
export function getJwtAccessTokenExpiresIn(env?: Env): string {
  return env?.JWT_ACCESS_TOKEN_EXPIRES_IN || DEFAULT_CONFIG.JWT_ACCESS_TOKEN_EXPIRES_IN
}

/**
 * 从环境变量获取 JWT 刷新令牌过期时间
 */
export function getJwtRefreshTokenExpiresIn(env?: Env): string {
  return env?.JWT_REFRESH_TOKEN_EXPIRES_IN || DEFAULT_CONFIG.JWT_REFRESH_TOKEN_EXPIRES_IN
}

/**
 * 检查是否允许注册
 * @param env - Cloudflare 环境变量
 * @returns 是否允许注册
 */
export function isRegistrationAllowed(env: Env): boolean {
  return env.ALLOW_REGISTRATION === 'true'
}

/**
 * 获取当前环境
 * @param env - Cloudflare 环境变量
 * @returns 当前环境
 */
export function getEnvironment(env: Env): 'development' | 'production' {
  return env.ENVIRONMENT || 'development'
}
