/**
 * TMarks API 基础客户端
 * 处理 HTTP 请求、认证、错误处理、速率限制
 */

import type { TMarksError, RateLimitInfo } from './types';

export interface TMarksClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class TMarksAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: any,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'TMarksAPIError';
  }

  // 便捷方法检查错误类型
  isAuthError(): boolean {
    return [
      'MISSING_API_KEY',
      'INVALID_API_KEY',
      'INSUFFICIENT_PERMISSIONS'
    ].includes(this.code);
  }

  isRateLimitError(): boolean {
    return this.code === 'RATE_LIMIT_EXCEEDED';
  }

  isNotFoundError(): boolean {
    return this.code === 'NOT_FOUND';
  }

  isDuplicateError(): boolean {
    return ['DUPLICATE_URL', 'DUPLICATE_TAG'].includes(this.code);
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

export class TMarksClient {
  private apiKey: string;
  private baseUrl: string;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(config: TMarksClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://tmarks.669696.xyz/api';
  }

  /**
   * 获取速率限制信息
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * 检查是否接近速率限制
   */
  isNearRateLimit(threshold: number = 0.2): boolean {
    if (!this.rateLimitInfo) return false;
    return this.rateLimitInfo.remaining / this.rateLimitInfo.limit < threshold;
  }

  /**
   * 获取速率限制重置时间
   */
  getRateLimitResetTime(): Date | null {
    if (!this.rateLimitInfo) return null;
    return new Date(this.rateLimitInfo.reset * 1000);
  }

  /**
   * 发起 HTTP 请求
   */
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // 提取速率限制信息
      this.extractRateLimitInfo(response);

      // 处理 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      // 解析响应
      const data = await response.json();

      // 处理错误响应
      if (!response.ok) {
        this.handleErrorResponse(response.status, data as TMarksError);
      }

      return data as T;
    } catch (error) {
      if (error instanceof TMarksAPIError) {
        throw error;
      }

      // 网络错误或其他错误
      if (error instanceof TypeError) {
        throw new TMarksAPIError(
          'NETWORK_ERROR',
          'Network error: Unable to connect to TMarks API',
          0,
          { originalError: error }
        );
      }

      throw new TMarksAPIError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error occurred',
        0,
        { originalError: error }
      );
    }
  }

  /**
   * GET 请求
   */
  protected async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(this.cleanParams(params)).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    });
  }

  /**
   * POST 请求
   */
  protected async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH 请求
   */
  protected async patch<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE 请求
   */
  protected async delete<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * 提取速率限制信息
   */
  private extractRateLimitInfo(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      };
    }
  }

  /**
   * 处理错误响应
   */
  private handleErrorResponse(status: number, errorData: TMarksError): never {
    const { code, message, details, retry_after } = errorData.error;

    throw new TMarksAPIError(
      code,
      message,
      status,
      details,
      retry_after
    );
  }

  /**
   * 清理参数（移除 undefined 值）
   */
  private cleanParams(params: Record<string, any>): Record<string, string> {
    const cleaned: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = String(value);
      }
    }

    return cleaned;
  }
}
