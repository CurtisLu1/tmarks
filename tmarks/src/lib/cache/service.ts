import Redis from 'ioredis';
import { loadCacheConfig } from './config';
import type { CacheConfig, CacheEntry, CacheSetOptions, CacheStats, CacheStrategyType } from './types';

export interface CacheServiceOptions {
  redisUrl?: string;
  config?: CacheConfig;
  logger?: Pick<typeof console, 'warn' | 'error'>;
}

export class CacheService {
  private readonly config: CacheConfig;
  private readonly memCache = new Map<string, CacheEntry>();
  private readonly redis?: Redis;
  private hits = 0;
  private misses = 0;
  private errorCount = 0;
  private readonly maxErrors = 10;
  private readonly cacheTimeout = 100;
  private readonly logger: Pick<typeof console, 'warn' | 'error'>;

  constructor(options?: CacheServiceOptions) {
    this.config = options?.config ?? loadCacheConfig();
    this.logger = options?.logger ?? console;

    const redisUrl = options?.redisUrl ?? process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.redis.connect().catch((error) => {
        this.logger.warn?.('Redis connect error:', error);
      });
    }
  }

  async get<T>(type: CacheStrategyType, key: string): Promise<T | null> {
    if (!this.isEnabled(type)) return null;

    try {
      const memCached = this.getFromMemory<T>(key);
      if (memCached !== null) {
        this.hits++;
        return memCached;
      }

      if (this.redis && this.config.strategies[type]) {
        const redisCached = await this.getFromRedis<T>(key);
        if (redisCached !== null) {
          this.hits++;
          this.setToMemory(key, redisCached, this.config.ttl[type]);
          return redisCached;
        }
      }

      this.misses++;
      return null;
    } catch (error) {
      this.handleError('get', error);
      this.misses++;
      return null;
    }
  }

  async set<T>(type: CacheStrategyType, key: string, data: T, options?: CacheSetOptions): Promise<void> {
    if (!this.isEnabled(type)) return;

    const effectiveTtl = this.resolveTtl(type, options);

    try {
      this.setToMemory(key, data, effectiveTtl);

      if (this.redis && this.config.strategies[type]) {
        if (options?.async) {
          void this.setToRedis(type, key, data, effectiveTtl);
        } else {
          await this.setToRedis(type, key, data, effectiveTtl);
        }
      }
    } catch (error) {
      this.handleError('set', error);
    }
  }

  async delete(key: string): Promise<void> {
    this.memCache.delete(key);
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (error) {
      this.handleError('delete', error);
    }
  }

  async invalidate(prefix: string): Promise<void> {
    for (const key of this.memCache.keys()) {
      if (key.startsWith(prefix)) this.memCache.delete(key);
    }

    if (!this.redis) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.handleError('invalidate', error);
    }
  }

  shouldCache(type: CacheStrategyType, params?: Record<string, unknown>): boolean {
    void params;
    return this.isEnabled(type);
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      enabled: this.config.enabled,
      level: this.config.level,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      memCacheSize: this.memCache.size,
      strategies: this.config.strategies,
    };
  }

  private isEnabled(type: CacheStrategyType): boolean {
    return this.config.enabled && this.config.strategies[type];
  }

  private resolveTtl(type: CacheStrategyType, options?: CacheSetOptions): number {
    const ttl = options?.ttl ?? this.config.ttl[type];
    return ttl > 0 ? ttl : 0;
  }

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memCache.get(key);
    if (!entry) return null;
    if (entry.expires > Date.now()) return entry.data as T;
    this.memCache.delete(key);
    return null;
  }

  private setToMemory<T>(key: string, data: T, ttlSeconds: number): void {
    if (!this.config.memoryCache.enabled) return;
    const ttlMs = (ttlSeconds || this.config.memoryCache.maxAge) * 1000;
    this.memCache.set(key, { data, expires: Date.now() + ttlMs });
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cacheTimeout);
    try {
      const result = await this.redis.get(key);
      if (!result) return null;
      return JSON.parse(result) as T;
    } catch (error) {
      this.handleError('redis.get', error);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async setToRedis<T>(type: CacheStrategyType, key: string, data: T, ttlSeconds: number): Promise<void> {
    if (!this.redis || !this.config.strategies[type]) return;
    try {
      const payload = JSON.stringify(data);
      if (ttlSeconds > 0) {
        await this.redis.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, payload);
      }
    } catch (error) {
      this.handleError('redis.set', error);
    }
  }

  private handleError(operation: string, error: unknown): void {
    this.errorCount += 1;
    if (this.errorCount >= this.maxErrors) {
      this.config.enabled = false;
      this.logger.error?.(`Cache disabled after repeated errors (${this.errorCount})`);
    }
    this.logger.warn?.(`Cache ${operation} error:`, error);
  }
}

