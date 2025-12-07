/**
 * TMarks API Client (增强版)
 * 基于官方 SDK，添加批量操作、速率限制跟踪、辅助方法等增强功能
 * 参考: SDK.md 和 API_DOCUMENTATION.md
 */

// ============ 类型定义 ============

export interface TMarksConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  cover_image: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  bookmark_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateBookmarkInput {
  title: string;
  url: string;
  description?: string;
  cover_image?: string;
  tag_ids?: string[];
  is_pinned?: boolean;
  is_archived?: boolean;
}

export interface UpdateBookmarkInput {
  title?: string;
  url?: string;
  description?: string;
  cover_image?: string;
  tag_ids?: string[];
  is_pinned?: boolean;
  is_archived?: boolean;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface SearchResult {
  query: string;
  results: {
    bookmarks: Bookmark[];
    tags: Tag[];
  };
  meta: {
    bookmark_count: number;
    tag_count: number;
  };
}

export interface UserInfo {
  id: string;
  username: string;
  email: string | null;
  created_at: string;
  stats: {
    total_bookmarks: number;
    pinned_bookmarks: number;
    archived_bookmarks: number;
    total_tags: number;
  };
}

// 批量操作类型
export interface BatchCreateBookmarksInput {
  bookmarks: CreateBookmarkInput[];
  skip_duplicates?: boolean;
}

export interface BatchUpdateBookmarksInput {
  updates: Array<{ id: string } & UpdateBookmarkInput>;
}

export interface BatchDeleteInput {
  ids: string[];
}

export interface BatchCreateTagsInput {
  tags: CreateTagInput[];
  skip_duplicates?: boolean;
}

export interface BatchOperationResult {
  success: boolean;
  id?: string;
  bookmark?: Bookmark;
  tag?: Tag;
  url?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface BatchOperationResponse {
  results: BatchOperationResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

// 速率限制信息
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

// ============ 自定义错误类 ============

export class TMarksAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'TMarksAPIError';
  }
}

// ============ TMarks 客户端 ============

export class TMarksClient {
  private config: Required<TMarksConfig>;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(config: TMarksConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://tmarks.669696.xyz/api',
    };
  }

  /**
   * 获取速率限制信息
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'X-API-Key': this.config.apiKey,
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

      // 处理错误响应
      if (!response.ok) {
        const error = await response.json();
        throw new TMarksAPIError(
          error.error?.code || 'UNKNOWN_ERROR',
          error.error?.message || `HTTP ${response.status}`,
          response.status,
          error.error?.details
        );
      }

      // 处理 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();
      return data.data as T;
    } catch (error) {
      if (error instanceof TMarksAPIError) {
        throw error;
      }

      // 网络错误
      if (error instanceof TypeError) {
        throw new TMarksAPIError(
          'NETWORK_ERROR',
          'Network error: Unable to connect to TMarks API',
          0,
          { originalError: error }
        );
      }

      throw error;
    }
  }

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

  // ========== 书签操作 ==========

  /**
   * 获取书签列表
   */
  async getBookmarks(params?: {
    keyword?: string;
    tags?: string;
    page_size?: number;
    page_cursor?: string;
    sort?: 'created' | 'updated' | 'pinned';
    archived?: boolean;
    pinned?: boolean;
  }): Promise<{
    bookmarks: Bookmark[];
    meta: {
      page_size: number;
      count: number;
      next_cursor: string | null;
      has_more: boolean;
    };
  }> {
    const query = new URLSearchParams();
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.tags) query.set('tags', params.tags);
    if (params?.page_size) query.set('page_size', params.page_size.toString());
    if (params?.page_cursor) query.set('page_cursor', params.page_cursor);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.archived !== undefined)
      query.set('archived', params.archived.toString());
    if (params?.pinned !== undefined)
      query.set('pinned', params.pinned.toString());

    const queryString = query.toString();
    return this.request(`/bookmarks${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * 创建书签
   */
  async createBookmark(data: CreateBookmarkInput): Promise<{ bookmark: Bookmark }> {
    return this.request('/bookmarks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取单个书签
   */
  async getBookmark(id: string): Promise<{ bookmark: Bookmark }> {
    return this.request(`/bookmarks/${id}`);
  }

  /**
   * 更新书签
   */
  async updateBookmark(
    id: string,
    data: UpdateBookmarkInput
  ): Promise<{ bookmark: Bookmark }> {
    return this.request(`/bookmarks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * 删除书签
   */
  async deleteBookmark(id: string): Promise<void> {
    await this.request(`/bookmarks/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 批量创建书签
   */
  async batchCreateBookmarks(
    input: BatchCreateBookmarksInput
  ): Promise<BatchOperationResponse> {
    return this.request('/bookmarks/batch', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * 批量更新书签
   */
  async batchUpdateBookmarks(
    input: BatchUpdateBookmarksInput
  ): Promise<BatchOperationResponse> {
    return this.request('/bookmarks/batch', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  /**
   * 批量删除书签
   */
  async batchDeleteBookmarks(
    input: BatchDeleteInput
  ): Promise<BatchOperationResponse> {
    return this.request('/bookmarks/batch', {
      method: 'DELETE',
      body: JSON.stringify(input),
    });
  }

  // ========== 标签操作 ==========

  /**
   * 获取标签列表
   */
  async getTags(): Promise<{ tags: Tag[] }> {
    return this.request('/tags');
  }

  /**
   * 创建标签
   */
  async createTag(data: CreateTagInput): Promise<{ tag: Tag }> {
    return this.request('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取单个标签
   */
  async getTag(id: string): Promise<{ tag: Tag }> {
    return this.request(`/tags/${id}`);
  }

  /**
   * 更新标签
   */
  async updateTag(id: string, data: UpdateTagInput): Promise<{ tag: Tag }> {
    return this.request(`/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * 删除标签
   */
  async deleteTag(id: string): Promise<void> {
    await this.request(`/tags/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 批量创建标签
   */
  async batchCreateTags(
    input: BatchCreateTagsInput
  ): Promise<BatchOperationResponse> {
    return this.request('/tags/batch', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ========== 用户信息 ==========

  /**
   * 获取当前用户信息
   */
  async getMe(): Promise<{ user: UserInfo }> {
    return this.request('/me');
  }

  // ========== 搜索 ==========

  /**
   * 全局搜索
   */
  async search(query: string, limit?: number): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', limit.toString());
    return this.request(`/search?${params.toString()}`);
  }

  // ========== 辅助方法 ==========

  /**
   * 获取所有书签（自动分页）
   */
  async getAllBookmarks(params?: Omit<Parameters<typeof this.getBookmarks>[0], 'page_cursor'> & { page_size?: number }): Promise<Bookmark[]> {
    const allBookmarks: Bookmark[] = [];
    let cursor: string | null = null;

    do {
      const response = await this.getBookmarks({
        ...params,
        page_cursor: cursor || undefined,
        page_size: params?.page_size || 100,
      });

      allBookmarks.push(...response.bookmarks);
      cursor = response.meta.next_cursor;
    } while (cursor);

    return allBookmarks;
  }

  /**
   * 根据标签 ID 获取书签
   */
  async getBookmarksByTags(tagIds: string[], params?: Omit<Parameters<typeof this.getBookmarks>[0], 'tags'>): Promise<ReturnType<typeof this.getBookmarks>> {
    return this.getBookmarks({
      ...params,
      tags: tagIds.join(','),
    });
  }

  /**
   * 根据标签名称查找标签
   */
  async findTagByName(name: string): Promise<Tag | null> {
    const { tags } = await this.getTags();
    return tags.find((t) => t.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * 创建标签（如果不存在）
   */
  async createTagIfNotExists(input: CreateTagInput): Promise<Tag> {
    try {
      const { tag } = await this.createTag(input);
      return tag;
    } catch (error: any) {
      if (error.code === 'DUPLICATE_TAG') {
        const existingTag = await this.findTagByName(input.name);
        if (existingTag) {
          return existingTag;
        }
      }
      throw error;
    }
  }

  /**
   * 置顶书签
   */
  async pinBookmark(id: string): Promise<{ bookmark: Bookmark }> {
    return this.updateBookmark(id, { is_pinned: true });
  }

  /**
   * 取消置顶
   */
  async unpinBookmark(id: string): Promise<{ bookmark: Bookmark }> {
    return this.updateBookmark(id, { is_pinned: false });
  }

  /**
   * 归档书签
   */
  async archiveBookmark(id: string): Promise<{ bookmark: Bookmark }> {
    return this.updateBookmark(id, { is_archived: true });
  }

  /**
   * 取消归档
   */
  async unarchiveBookmark(id: string): Promise<{ bookmark: Bookmark }> {
    return this.updateBookmark(id, { is_archived: false });
  }

  /**
   * 检查 API Key 是否有效
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getMe();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取用户统计信息
   */
  async getStats(): Promise<UserInfo['stats']> {
    const { user } = await this.getMe();
    return user.stats;
  }
}
