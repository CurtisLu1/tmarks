import { describe, expect, it, vi } from 'vitest';
import { assert, asyncProperty, string } from 'fast-check';

import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';

interface MockAuthState {
  accessToken: string;
  refreshToken: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshAccessToken: () => Promise<void>;
  clearAuth: () => void;
}

vi.mock('@/stores/authStore', () => {
  const state = {
    accessToken: 'old-token',
    refreshToken: 'refresh-token',
    isAuthenticated: true,
    isLoading: false,
    refreshAccessToken: vi.fn(async () => {
      state.accessToken = 'new-token';
    }),
    clearAuth: vi.fn(),
  };
  return {
    useAuthStore: {
      getState: () => state,
    },
  };
});

const originalFetch = global.fetch;

describe('Property 4: Token 刷新流程', () => {
  beforeEach(() => {
    const state = useAuthStore.getState() as MockAuthState;
    state.accessToken = 'old-token';
    state.refreshToken = 'refresh-token';
    state.isAuthenticated = true;
    state.isLoading = false;
    state.refreshAccessToken = vi.fn(async () => {
      state.accessToken = 'new-token';
    });
    state.clearAuth = vi.fn();
    global.fetch = originalFetch;
  });

  it('401 后会刷新 token 并重试请求', async () => {
    await assert(
      asyncProperty(string(), async (path) => {
        const first = {
          status: 401,
          ok: false,
          text: vi.fn().mockResolvedValue(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })),
        } as unknown as Response;

        const second = {
          status: 200,
          ok: true,
          text: vi.fn().mockResolvedValue(JSON.stringify({ data: { ok: true, path } })),
        } as unknown as Response;

        const fetchMock = vi
          .fn()
          .mockResolvedValueOnce(first)
          .mockResolvedValueOnce(second);
        // @ts-expect-error override fetch
        global.fetch = fetchMock;

        const res = await apiClient.get<{ ok: boolean; path: string }>(`/${path}`);
        expect(res.data.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // 确认第二次请求使用刷新后的 token
        expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers)?.get('Authorization')).toContain('new-token');
      }),
    );
  });

  it('刷新失败会清除认证并抛出错误', async () => {
    const state = useAuthStore.getState() as MockAuthState;
    state.refreshAccessToken = vi.fn(async () => {
      throw new Error('refresh failed');
    });

    const first = {
      status: 401,
      ok: false,
      text: vi.fn().mockResolvedValue(''),
    } as unknown as Response;

    const fetchMock = vi.fn().mockResolvedValue(first);
    // @ts-expect-error override fetch
    global.fetch = fetchMock;

    await expect(apiClient.get('/any')).rejects.toThrow(/Unauthorized|refresh failed/);
    expect(state.clearAuth).toHaveBeenCalled();
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.resetAllMocks();
});

