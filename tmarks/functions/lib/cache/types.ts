/**
 * 缓存系统类型定义
 * 
 * 提供类型安全的缓存配置和接口
 */

/**
 * 缓存级别
 * - 0: 无缓存 (最低成本)
 * - 1: 最小缓存 (推荐默认)
 * - 2: 标准缓存 (推荐生产)
 * - 3: 激进缓存 (高性能)
 */
export type CacheLevel = 0 | 1 | 2 | 3

/**
 * 缓存策略类型
 */
export type CacheStrategyType =
  | 'rateLimit'      // 速率限制 (必需)
  | 'publicShare'    // 公开分享
  | 'defaultList'    // 默认列表
  | 'tagFilter'      // 标签筛选
  | 'search'         // 搜索结果
  | 'complexQuery'   // 复杂查询

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  /** 缓存级别 */
  level: CacheLevel
  
  /** 是否启用缓存 */
  enabled: boolean
  
  /** 各类查询的缓存策略 */
  strategies: Record<CacheStrategyType, boolean>
  
  /** TTL 配置 (秒) */
  ttl: Record<CacheStrategyType, number>
  
  /** 内存缓存配置 */
  memoryCache: {
    enabled: boolean
    maxAge: number  // 秒
  }
  
  /** 批量操作配置 */
  batchOperations: {
    writeCache: boolean   // 是否写缓存
    asyncWrite: boolean   // 异步写入
  }
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = unknown> {
  data: T
  expires: number  // 时间戳
}

/**
 * 缓存操作选项
 */
export interface CacheSetOptions {
  /** 是否异步写入 */
  async?: boolean
  
  /** 自定义 TTL (覆盖默认值) */
  ttl?: number
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  level: CacheLevel
  enabled: boolean
  hits: number
  misses: number
  hitRate: number
  memCacheSize: number
  strategies: Record<CacheStrategyType, boolean>
}

/**
 * 查询参数接口 (用于缓存键生成)
 */
export interface QueryParams {
  keyword?: string
  tags?: string[]
  archived?: boolean
  pinned?: boolean
  sort?: string
  page_size?: number
  page_cursor?: string
}
