import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assert, asyncProperty, boolean, record, string } from 'fast-check';

import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/services/auth', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
  },
}));

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
};

describe('Property 6: JWT 认证流程', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState((state) => ({ ...state, ...initialAuthState }), true);
    vi.clearAllMocks();
  });

  it('有效凭据返回 access_token 与 refresh_token 并持久化', async () => {
    await assert(
      asyncProperty(
        record({
          username: string({ minLength: 1, maxLength: 16 }),
          password: string({ minLength: 6, maxLength: 24 }),
          rememberMe: boolean(),
          access: string({ minLength: 12, maxLength: 32 }),
          refresh: string({ minLength: 12, maxLength: 32 }),
        }),
        async ({ username, password, rememberMe, access, refresh }) => {
          vi.mocked(authService.login).mockResolvedValueOnce({
            access_token: access,
            refresh_token: refresh,
            token_type: 'Bearer',
            expires_in: 3600,
            user: { id: 'user-1', username, email: null },
          });

          await useAuthStore.getState().login(username, password, rememberMe);

          const state = useAuthStore.getState();
          expect(state.isAuthenticated).toBe(true);
          expect(state.accessToken).toBe(access);
          expect(state.refreshToken).toBe(refresh);
          expect(state.user?.username).toBe(username);
          expect(authService.login).toHaveBeenCalledWith({
            username,
            password,
            remember_me: rememberMe,
          });
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe('Property 11: 认证状态持久化', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState((state) => ({ ...state, ...initialAuthState }), true);
    vi.clearAllMocks();
  });

  it('登录后的认证状态在刷新后保持', async () => {
    const username = 'persist-user';
    const password = 'persist-pass';
    const tokens = { access: 'persist-access', refresh: 'persist-refresh' };

    vi.mocked(authService.login).mockResolvedValueOnce({
      access_token: tokens.access,
      refresh_token: tokens.refresh,
      token_type: 'Bearer',
      expires_in: 3600,
      user: { id: 'user-1', username, email: null },
    });

    await useAuthStore.getState().login(username, password, true);

    const persisted = JSON.parse(localStorage.getItem('auth-storage') ?? '{}');
    expect(persisted.state.accessToken).toBe(tokens.access);
    expect(persisted.state.refreshToken).toBe(tokens.refresh);
    expect(persisted.state.isAuthenticated).toBe(true);

    useAuthStore.setState((state) => ({ ...state, ...initialAuthState }), true);
    useAuthStore.setState((state) => ({ ...state, ...persisted.state }), true);

    const rehydrated = useAuthStore.getState();
    expect(rehydrated.isAuthenticated).toBe(true);
    expect(rehydrated.accessToken).toBe(tokens.access);
    expect(rehydrated.refreshToken).toBe(tokens.refresh);
    expect(rehydrated.user?.username).toBe(username);
  });
});

