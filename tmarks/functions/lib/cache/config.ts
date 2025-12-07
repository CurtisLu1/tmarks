/**
 * 缓存配置管理
 * 
 * 提供预设配置和配置加载功能
 */

import type { CacheConfig, CacheLevel } from './types'
import type { Env } from '../types'

/**
 * 预设缓存配置
 */
export const CACHE_PRESETS: Record<CacheLevel, CacheConfig> = {
  /**
   * Level 0: 免费套餐模式 (推荐默认)
   * - 适用: 免费套餐用户
   * - 成本: $0/月 (完全免费)
   * - 性能: 30-100ms
   * - 特点: 只缓存书签列表，控制写入频率
   * - KV 写入: ~100-500 次/天 (在免费额度内)
   */
  0: {
    level: 0,
    enabled: true,          // 启用缓存
    strategies: {
      rateLimit: false,     // 不用 KV 速率限制 (避免频繁写入)
      publicShare: true,    // 缓存公开分享 (低频写入)
      defaultList: true,    // 缓存默认书签列表 (适度写入)
      tagFilter: false,     // 不缓存标签筛选 (避免写入)
      search: false,        // 不缓存搜索 (避免写入)
      complexQuery: false,
    },
    ttl: {
      rateLimit: 0,
      publicShare: 1800,    // 30分钟 (减少写入频率)
      defaultList: 1800,    // 30分钟 (减少写入频率)
      tagFilter: 0,
      search: 0,
      complexQuery: 0,
    },
    memoryCache: {
      enabled: true,        // 启用内存缓存 (免费)
      maxAge: 60,           // 1分钟
    },
    batchOperations: {
      writeCache: false,    // 批量操作不写缓存 (避免大量写入)
      asyncWrite: false,
    },
  },

  /**
   * Level 1: 极简 KV 模式
   * - 适用: 小流量用户 (<100 请求/天)
   * - 成本: $0-2/月 (可能超出免费额度)
   * - 性能: 50-100ms, 命中率 40-50%
   * - 特点: 极少 KV 写入 (<1000 次/天)
   */
  1: {
    level: 1,
    enabled: true,
    strategies: {
      rateLimit: false,     // 不用 KV 速率限制 (避免大量写入)
      publicShare: true,    // 只缓存公开分享 (低频写入)
      defaultList: false,   // 不缓存列表 (避免写入)
      tagFilter: false,
      search: false,
      complexQuery: false,
    },
    ttl: {
      rateLimit: 0,
      publicShare: 1800,    // 30分钟 (减少写入频率)
      defaultList: 0,
      tagFilter: 0,
      search: 0,
      complexQuery: 0,
    },
    memoryCache: {
      enabled: true,        // 启用内存缓存
      maxAge: 60,
    },
    batchOperations: {
      writeCache: false,    // 批量操作不写缓存
      asyncWrite: false,
    },
  },

  /**
   * Level 2: 标准 KV 模式 (付费用户)
   * - 适用: 中型应用 (1000-10000 用户)
   * - 成本: ~$8-12/月
   * - 性能: 30-50ms, 命中率 70-80%
   * - 特点: 适度使用 KV，控制写入
   */
  2: {
    level: 2,
    enabled: true,
    strategies: {
      rateLimit: true,      // 使用优化的速率限制
      publicShare: true,
      defaultList: true,    // 缓存默认列表
      tagFilter: false,     // 不缓存标签筛选 (减少写入)
      search: false,
      complexQuery: false,
    },
    ttl: {
      rateLimit: 60,
      publicShare: 1800,    // 30分钟
      defaultList: 600,     // 10分钟
      tagFilter: 0,
      search: 0,
      complexQuery: 0,
    },
    memoryCache: {
      enabled: true,        // 启用内存缓存
      maxAge: 60,           // 1分钟
    },
    batchOperations: {
      writeCache: false,    // 批量操作不写缓存
      asyncWrite: false,
    },
  },

  /**
   * Level 3: 完整 KV 模式 (高流量付费)
   * - 适用: 大型应用 (>10000 用户)
   * - 成本: ~$15-25/月
   * - 性能: 20-30ms, 命中率 85-90%
   * - 特点: 完整使用 KV，但控制写入频率
   */
  3: {
    level: 3,
    enabled: true,
    strategies: {
      rateLimit: true,
      publicShare: true,
      defaultList: true,
      tagFilter: true,      // 缓存标签筛选
      search: false,        // 不缓存搜索 (写入太多)
      complexQuery: false,
    },
    ttl: {
      rateLimit: 60,
      publicShare: 1800,    // 30分钟
      defaultList: 600,     // 10分钟
      tagFilter: 600,       // 10分钟
      search: 0,
      complexQuery: 0,
    },
    memoryCache: {
      enabled: true,
      maxAge: 60,
    },
    batchOperations: {
      writeCache: false,    // 批量操作不写缓存 (避免大量写入)
      asyncWrite: false,
    },
  },
}

/**
 * 从环境变量加载缓存配置
 */
export function loadCacheConfig(env: Env): CacheConfig {
  // 检查是否明确禁用 KV 缓存
  if (env.ENABLE_KV_CACHE === 'false') {
    return CACHE_PRESETS[0]
  }

  // 解析缓存级别
  const levelStr = env.CACHE_LEVEL || '1'
  let level: CacheLevel = 1

  // 支持数字和字符串格式
  if (levelStr === 'none' || levelStr === '0') {
    level = 0
  } else if (levelStr === 'minimal' || levelStr === '1') {
    level = 1
  } else if (levelStr === 'standard' || levelStr === '2') {
    level = 2
  } else if (levelStr === 'aggressive' || levelStr === '3') {
    level = 3
  } else {
    const parsed = parseInt(levelStr, 10)
    if (parsed >= 0 && parsed <= 3) {
      level = parsed as CacheLevel
    }
  }

  // 获取预设配置
  const config = { ...CACHE_PRESETS[level] }

  // 允许通过环境变量覆盖 TTL
  if (env.CACHE_TTL_DEFAULT_LIST) {
    config.ttl.defaultList = parseInt(env.CACHE_TTL_DEFAULT_LIST, 10)
  }
  if (env.CACHE_TTL_TAG_FILTER) {
    config.ttl.tagFilter = parseInt(env.CACHE_TTL_TAG_FILTER, 10)
  }
  if (env.CACHE_TTL_SEARCH) {
    config.ttl.search = parseInt(env.CACHE_TTL_SEARCH, 10)
  }
  if (env.CACHE_TTL_PUBLIC_SHARE) {
    config.ttl.publicShare = parseInt(env.CACHE_TTL_PUBLIC_SHARE, 10)
  }

  // 允许通过环境变量覆盖内存缓存
  if (env.ENABLE_MEMORY_CACHE === 'false') {
    config.memoryCache.enabled = false
  }
  if (env.MEMORY_CACHE_MAX_AGE) {
    config.memoryCache.maxAge = parseInt(env.MEMORY_CACHE_MAX_AGE, 10)
  }

  return config
}

/**
 * 验证缓存配置
 */
export function validateCacheConfig(config: CacheConfig): boolean {
  // 检查级别
  if (config.level < 0 || config.level > 3) {
    return false
  }

  // 检查 TTL
  for (const ttl of Object.values(config.ttl)) {
    if (ttl < 0 || ttl > 86400) {  // 最大 24 小时
      return false
    }
  }

  // 检查内存缓存
  if (config.memoryCache.maxAge < 0 || config.memoryCache.maxAge > 3600) {
    return false
  }

  return true
}
