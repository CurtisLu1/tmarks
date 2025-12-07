/**
 * 缓存系统导出接口
 * 
 * 统一导出所有缓存相关的类型和功能
 */

// 导出类型
export type {
  CacheLevel,
  CacheStrategyType,
  CacheConfig,
  CacheEntry,
  CacheSetOptions,
  CacheStats,
  QueryParams,
} from './types'

// 导出配置
export {
  CACHE_PRESETS,
  loadCacheConfig,
  validateCacheConfig,
} from './config'

// 导出策略
export {
  generateCacheKey,
  getQueryType,
  shouldCacheQuery,
  getCacheInvalidationPrefix,
  hashQueryParams,
} from './strategies'

// 导出服务
export { CacheService } from './service'
