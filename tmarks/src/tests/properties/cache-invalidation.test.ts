// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { CacheService } from '@/lib/cache/service';
import type { CacheConfig } from '@/lib/cache/types';

const config: CacheConfig = {
  enabled: true,
  level: 1,
  strategies: {
    defaultList: true,
    tagFilter: true,
    search: true,
    publicShare: true,
    rateLimit: true,
  },
  ttl: {
    defaultList: 300,
    tagFilter: 300,
    search: 300,
    publicShare: 300,
    rateLimit: 300,
  },
  memoryCache: {
    enabled: true,
    maxAge: 300,
  },
};

describe('属性测试: Cache Invalidation by Prefix', () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService({ config });
  });

  it('按前缀失效应仅清除匹配的键', async () => {
    await service.set('defaultList', 'user:1:a', { a: 1 });
    await service.set('defaultList', 'user:1:b', { b: 1 });
    await service.set('defaultList', 'user:2:a', { c: 1 });

    await service.invalidate('user:1:');

    const a = await service.get('defaultList', 'user:1:a');
    const b = await service.get('defaultList', 'user:1:b');
    const c = await service.get('defaultList', 'user:2:a');

    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(c).toEqual({ c: 1 });
  });
});

