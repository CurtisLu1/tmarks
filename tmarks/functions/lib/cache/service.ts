/**
 * 核心缓存服务
 * 
 * 提供统一的缓存接口，支持多层缓存和优雅降级
 */

import type { KVNamespace } from '@cloudflare/workers-types'
import type { Env } from '../types'
import type {
  CacheConfig,
  CacheStrategyType,
  CacheEntry,
  CacheSetOptions,
  CacheStats,
} from './types'
import { loadCacheConfig } from './config'
import { shouldCacheQuery } from './strategies'

/**
 * 缓存服务类
 */
export class CacheService {
  private config: CacheConfig
  private env: Env
  private memCache: Map<string, CacheEntry> = new Map()
  private hits = 0
  private misses = 0
  private errorCount = 0
  private readonly MAX_ERRORS = 10
  private readonly CACHE_TIMEOUT = 100  // 100ms 超时

  constructor(env: Env) {
    this.env = env
    this.config = loadCacheConfig(env)
  }

  /**
   * 获取缓存数据
   * 自动处理多层缓存和降级
   */
  async get<T>(
    type: CacheStrategyType,
    key: string
  ): Promise<T | null> {
    // 检查是否启用该类型缓存
    if (!this.isEnabled(type)) {
      return null
    }

    try {
      // L1: 内存缓存
      if (this.config.memoryCache.enabled) {
        const memCached = this.getFromMemory<T>(key)
        if (memCached !== null) {
          this.hits++
          return memCached
        }
      }

      // L2: KV 缓存
      if (this.env.TMARKS_KV) {
        const kvCached = await this.getFromKV<T>(type, key)
        if (kvCached !== null) {
          this.hits++
          // 回填内存缓存
          if (this.config.memoryCache.enabled) {
            this.setToMemory(key, kvCached)
          }
          return kvCached
        }
      }

      this.misses++
      return null
    } catch (error) {
      this.handleError('get', error)
      this.misses++
      return null
    }
  }

  /**
   * 设置缓存数据
   * 自动处理多层缓存和错误
   */
  async set<T>(
    type: CacheStrategyType,
    key: string,
    data: T,
    options?: CacheSetOptions
  ): Promise<void> {
    // 检查是否启用该类型缓存
    if (!this.isEnabled(type)) {
      return
    }

    // 异步写入（不阻塞主流程）
    if (options?.async) {
      this.setAsync(type, key, data, options)
      return
    }

    try {
      // L1: 内存缓存
      if (this.config.memoryCache.enabled) {
        this.setToMemory(key, data)
      }

      // L2: KV 缓存 (只在策略启用时写入)
      if (this.config.strategies[type] && this.env.TMARKS_KV) {
        await this.setToKV(type, key, data, options)
      }
    } catch (error) {
      this.handleError('set', error)
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    try {
      // 删除内存缓存
      this.memCache.delete(key)

      // 删除 KV 缓存
      if (this.env.TMARKS_KV) {
        await this.env.TMARKS_KV.delete(key)
      }
    } catch (error) {
      this.handleError('delete', error)
    }
  }

  /**
   * 批量删除缓存（按前缀）
   */
  async invalidate(prefix: string): Promise<void> {
    try {
      // 清除内存缓存
      const keysToDelete: string[] = []
      this.memCache.forEach((_, key) => {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => this.memCache.delete(key))

      // 清除 KV 缓存
      await this.invalidateKV(prefix)
    } catch (error) {
      this.handleError('invalidate', error)
    }
  }

  /**
   * 判断是否应该缓存
   */
  shouldCache(type: CacheStrategyType, params?: Record<string, unknown>): boolean {
    if (!this.isEnabled(type)) {
      return false
    }
    return shouldCacheQuery(type, params)
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses
    return {
      level: this.config.level,
      enabled: this.config.enabled,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      memCacheSize: this.memCache.size,
      strategies: this.config.strategies,
    }
  }

  /**
   * 获取配置
   */
  getConfig(): CacheConfig {
    return { ...this.config }
  }

  // ==================== 私有方法 ====================

  /**
   * 检查是否启用该类型缓存
   */
  private isEnabled(type: CacheStrategyType): boolean {
    return this.config.enabled && this.config.strategies[type]
  }

  /**
   * 从内存缓存获取
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memCache.get(key)
    if (entry && entry.expires > Date.now()) {
      return entry.data as T
    }
    // 过期则删除
    if (entry) {
      this.memCache.delete(key)
    }
    return null
  }

  /**
   * 写入内存缓存
   */
  private setToMemory<T>(key: string, data: T): void {
    const maxAge = this.config.memoryCache.maxAge * 1000
    this.memCache.set(key, {
      data,
      expires: Date.now() + maxAge,
    })
  }

  /**
   * 从 KV 获取
   */
  private async getFromKV<T>(type: CacheStrategyType, key: string): Promise<T | null> {
    const kv = this.getKVNamespace(type)
    if (!kv) return null

    // 使用超时保护
    const result = await Promise.race([
      kv.get(key, 'json'),
      this.timeout(this.CACHE_TIMEOUT),
    ])

    return result as T | null
  }

  /**
   * 写入 KV
   */
  private async setToKV<T>(
    type: CacheStrategyType,
    key: string,
    data: T,
    options?: CacheSetOptions
  ): Promise<void> {
    const kv = this.getKVNamespace(type)
    if (!kv) return

    const ttl = options?.ttl || this.config.ttl[type] || 600

    await kv.put(key, JSON.stringify(data), {
      expirationTtl: ttl,
    })
  }

  /**
   * 异步写入缓存（不阻塞主流程）
   */
  private setAsync<T>(
    type: CacheStrategyType,
    key: string,
    data: T,
    options?: CacheSetOptions
  ): void {
    // 只在策略启用时异步写入
    if (!this.config.strategies[type]) {
      return
    }

    Promise.resolve().then(async () => {
      try {
        await this.setToKV(type, key, data, options)
      } catch (error) {
        // 异步写入失败不影响主流程
        console.warn('Async cache set error:', error)
      }
    })
  }

  /**
   * 失效 KV 缓存
   */
  private async invalidateKV(prefix: string): Promise<void> {
    if (!this.env.TMARKS_KV) return

    try {
      const keys = await this.env.TMARKS_KV.list({ prefix })
      await Promise.all(
        keys.keys.map(k => this.env.TMARKS_KV!.delete(k.name))
      )
    } catch (error) {
      console.warn('KV invalidate error:', error)
    }
  }

  /**
   * 获取 KV Namespace（统一使用 TMARKS_KV）
   */
  private getKVNamespace(type: CacheStrategyType): KVNamespace | undefined {
    // 参数目前未用于区分不同策略的 KV，但保留以便未来扩展
    void type
    return this.env.TMARKS_KV
  }

  /**
   * 超时 Promise
   */
  private timeout(ms: number): Promise<null> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), ms)
    })
  }

  /**
   * 错误处理
   */
  private handleError(operation: string, error: unknown): void {
    this.errorCount++

    // 错误过多时禁用缓存
    if (this.errorCount >= this.MAX_ERRORS) {
      console.error(`Too many cache errors (${this.errorCount}), disabling cache`)
      this.config.enabled = false
    }

    // 记录错误
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Cache ${operation} error:`, message)
  }
}
