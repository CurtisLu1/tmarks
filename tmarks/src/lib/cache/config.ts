import type { CacheConfig, CacheStrategyType, CacheTtlConfig } from './types';

const DEFAULT_TTL: CacheTtlConfig = {
  defaultList: 600,
  tagFilter: 600,
  search: 120,
  publicShare: 1800,
  rateLimit: 60,
};

const DEFAULT_STRATEGIES: Record<CacheStrategyType, boolean> = {
  defaultList: true,
  tagFilter: true,
  search: false,
  publicShare: true,
  rateLimit: true,
};

export function loadCacheConfig(env: NodeJS.ProcessEnv = process.env): CacheConfig {
  const level = parseLevel(env.CACHE_LEVEL);
  const enabled = env.ENABLE_CACHE !== 'false';

  const strategies: Record<CacheStrategyType, boolean> = {
    ...DEFAULT_STRATEGIES,
  };

  const ttl: CacheTtlConfig = {
    ...DEFAULT_TTL,
  };

  if (env.CACHE_TTL_DEFAULT_LIST) ttl.defaultList = parsePositive(env.CACHE_TTL_DEFAULT_LIST, ttl.defaultList);
  if (env.CACHE_TTL_TAG_FILTER) ttl.tagFilter = parsePositive(env.CACHE_TTL_TAG_FILTER, ttl.tagFilter);
  if (env.CACHE_TTL_SEARCH) ttl.search = parsePositive(env.CACHE_TTL_SEARCH, ttl.search);
  if (env.CACHE_TTL_PUBLIC_SHARE) ttl.publicShare = parsePositive(env.CACHE_TTL_PUBLIC_SHARE, ttl.publicShare);
  if (env.CACHE_TTL_RATE_LIMIT) ttl.rateLimit = parsePositive(env.CACHE_TTL_RATE_LIMIT, ttl.rateLimit);

  if (env.ENABLE_TAG_FILTER_CACHE === 'false') strategies.tagFilter = false;
  if (env.ENABLE_SEARCH_CACHE === 'true') strategies.search = true;

  const memoryCache = {
    enabled: env.ENABLE_MEMORY_CACHE !== 'false',
    maxAge: env.MEMORY_CACHE_MAX_AGE ? parsePositive(env.MEMORY_CACHE_MAX_AGE, 60) : 60,
  };

  return {
    enabled,
    level,
    strategies,
    ttl,
    memoryCache,
  };
}

function parseLevel(input?: string): 0 | 1 | 2 | 3 {
  const value = input ?? '2';
  if (value === 'none' || value === '0') return 0;
  if (value === 'minimal' || value === '1') return 1;
  if (value === 'aggressive' || value === '3') return 3;
  const parsed = Number.parseInt(value, 10);
  if (parsed >= 0 && parsed <= 3) return parsed as 0 | 1 | 2 | 3;
  return 2;
}

function parsePositive(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

