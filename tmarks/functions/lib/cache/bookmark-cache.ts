/**
 * 书签缓存辅助工具
 * 
 * 提供书签相关的缓存操作封装
 */

import { CacheService } from './service'
import { generateCacheKey, getQueryType, getCacheInvalidationPrefix } from './strategies'
import type { QueryParams } from './types'

/**
 * 书签缓存管理器
 */
export class BookmarkCacheManager {
  constructor(private cache: CacheService) {}

  /**
   * 获取书签列表缓存
   */
  async getBookmarkList<T>(userId: string, params?: QueryParams): Promise<T | null> {
    const queryType = getQueryType(params)
    
    if (!this.cache.shouldCache(queryType, params)) {
      return null
    }

    const cacheKey = generateCacheKey(queryType, userId, params)
    return await this.cache.get<T>(queryType, cacheKey)
  }

  /**
   * 设置书签列表缓存
   */
  async setBookmarkList<T>(
    userId: string,
    params: QueryParams | undefined,
    data: T,
    options?: { async?: boolean }
  ): Promise<void> {
    const queryType = getQueryType(params)
    
    if (!this.cache.shouldCache(queryType, params)) {
      return
    }

    const cacheKey = generateCacheKey(queryType, userId, params)
    await this.cache.set(queryType, cacheKey, data, options)
  }

  /**
   * 失效用户的所有书签缓存
   */
  async invalidateUserBookmarks(userId: string): Promise<void> {
    const prefix = getCacheInvalidationPrefix(userId)
    await this.cache.invalidate(prefix)
  }

  /**
   * 失效特定查询的缓存
   */
  async invalidateQuery(userId: string, params?: QueryParams): Promise<void> {
    const queryType = getQueryType(params)
    const cacheKey = generateCacheKey(queryType, userId, params)
    await this.cache.delete(cacheKey)
  }

  /**
   * 批量操作后的缓存处理
   */
  async handleBatchOperation(userId: string): Promise<void> {
    const config = this.cache.getConfig()

    if (config.batchOperations.writeCache && config.batchOperations.asyncWrite) {
      // Level 3: 异步刷新常用查询
      this.refreshCommonQueries(userId)
    } else {
      // Level 0-2: 只失效缓存
      await this.invalidateUserBookmarks(userId)
    }
  }

  /**
   * 异步刷新常用查询（不阻塞主流程）
   */
  private refreshCommonQueries(userId: string): void {
    // 异步执行，不等待结果
    Promise.resolve().then(async () => {
      try {
        // 失效现有缓存
        await this.invalidateUserBookmarks(userId)
        
        // 注意：实际的数据刷新应该在下次查询时自动完成
        // 这里只是失效缓存，让下次查询时重新缓存
      } catch (error) {
        console.warn('Refresh common queries error:', error)
      }
    })
  }
}

/**
 * 创建书签缓存管理器
 */
export function createBookmarkCacheManager(cache: CacheService): BookmarkCacheManager {
  return new BookmarkCacheManager(cache)
}
