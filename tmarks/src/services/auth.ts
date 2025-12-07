import { apiClient } from '@/lib/api-client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '@/lib/types'

export const authService = {
  /**
   * 用户注册
   */
  async register(data: RegisterRequest) {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data)
    return response.data!
  },

  /**
   * 用户登录
   */
  async login(data: LoginRequest) {
    const response = await apiClient.post<LoginResponse>('/auth/login', data)
    return response.data!
  },

  /**
   * 刷新访问令牌
   */
  async refreshToken(data: RefreshTokenRequest) {
    const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', data)
    return response.data!
  },

  /**
   * 登出
   */
  async logout(refreshToken: string, revokeAll = false) {
    await apiClient.post('/auth/logout', {
      refresh_token: refreshToken,
      revoke_all: revokeAll,
    })
  },
}
