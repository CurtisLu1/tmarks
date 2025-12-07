// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '@/lib/cache/service';
import type { CacheConfig } from '@/lib/cache/types';

const baseConfig: CacheConfig = {
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
    defaultList: 1,
    tagFilter: 1,
    search: 1,
    publicShare: 1,
    rateLimit: 1,
  },
  memoryCache: {
    enabled: true,
    maxAge: 1,
  },
};

describe('属性测试: Cache Round-Trip', () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService({ config: baseConfig });
    vi.useFakeTimers();
  });

  it('写入后立即读取应返回相同数据，并在 TTL 后失效', async () => {
    const key = 'cache:test:key';
    const payload = { value: 'hello' };

    await service.set('defaultList', key, payload);
    const cached = await service.get<typeof payload>('defaultList', key);
    expect(cached).toEqual(payload);

    vi.advanceTimersByTime(1500);
    const expired = await service.get<typeof payload>('defaultList', key);
    expect(expired).toBeNull();
  });
});

