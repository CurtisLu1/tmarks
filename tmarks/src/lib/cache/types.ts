export type CacheStrategyType = 'defaultList' | 'tagFilter' | 'search' | 'publicShare' | 'rateLimit';

export interface CacheTtlConfig {
  defaultList: number;
  tagFilter: number;
  search: number;
  publicShare: number;
  rateLimit: number;
}

export interface MemoryCacheConfig {
  enabled: boolean;
  maxAge: number;
}

export interface CacheConfig {
  enabled: boolean;
  level: 0 | 1 | 2 | 3;
  strategies: Record<CacheStrategyType, boolean>;
  ttl: CacheTtlConfig;
  memoryCache: MemoryCacheConfig;
}

export interface CacheSetOptions {
  async?: boolean;
  ttl?: number;
}

export interface CacheEntry<T = unknown> {
  data: T;
  expires: number;
}

export interface CacheStats {
  enabled: boolean;
  level: number;
  hits: number;
  misses: number;
  hitRate: number;
  memCacheSize: number;
  strategies: Record<CacheStrategyType, boolean>;
}

