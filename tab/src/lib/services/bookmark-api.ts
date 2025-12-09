import type {
  BookmarkInput,
  Tag,
  Bookmark,
  ErrorCode
} from '@/types';
import { AppError } from '@/types';
import { StorageService } from '@/lib/utils/storage';
import { createTMarksClient, type TMarksBookmark, type TMarksTag } from '@/lib/api/tmarks';
import { getTMarksUrls, normalizeApiUrl } from '@/lib/constants/urls';

export class BookmarkAPIClient {
  private client: ReturnType<typeof createTMarksClient> | null = null;

  async initialize(): Promise<void> {
    const configuredUrl = await StorageService.getBookmarkSiteApiUrl();
    const apiKey = await StorageService.getBookmarkSiteApiKey();

    if (!apiKey) {
      throw new AppError(
        'API_KEY_INVALID' as ErrorCode,
        'TMarks API key is required. Please configure your API key in the extension settings.'
      );
    }

    // 标准化 API 基础地址，自动补齐 /api/v1（兼容旧的 /api 或基础域名）
    const apiBaseUrl = normalizeApiUrl(configuredUrl || getTMarksUrls().BASE_URL);

    // Create TMarks client with proper API key
    this.client = createTMarksClient({
      apiKey,
      baseUrl: apiBaseUrl
    });
  }

  private async ensureClient(): Promise<ReturnType<typeof createTMarksClient>> {
    if (!this.client) {
      await this.initialize();
    }
    if (!this.client) {
      throw new AppError(
        'API_KEY_INVALID' as ErrorCode,
        'Failed to initialize TMarks client'
      );
    }
    return this.client;
  }


  /**
   * Get all tags from bookmark site
   */
  async getTags(): Promise<Tag[]> {
    const client = await this.ensureClient();

    try {
      const response = await client.tags.getTags();

      // Convert TMarks API format to internal format
      return response.data.tags.map((tag: TMarksTag) => ({
        name: tag.name,
        color: tag.color,
        count: tag.bookmark_count || 0,
        createdAt: new Date(tag.created_at).getTime()
      }));
    } catch (error: any) {
      if (error.code === 'MISSING_API_KEY') {
        throw new AppError(
          'API_KEY_INVALID' as ErrorCode,
          'TMarks API key is required. Please configure your API key in the extension settings.',
          { originalError: error }
        );
      }
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to fetch tags: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Get bookmarks with pagination
   */
  /**
   * Get bookmarks with pagination
   */
  async getBookmarks(cursor?: string, limit: number = 100): Promise<{
    bookmarks: Bookmark[];
    hasMore: boolean;
    nextCursor?: string | null;
  }> {
    const client = await this.ensureClient();

    try {
      const response = await client.bookmarks.getBookmarks({
        page_size: limit,
        page_cursor: cursor
      });

      if (!response.data.bookmarks.length) {
        return { bookmarks: [], hasMore: false, nextCursor: null };
      }

      // Convert TMarks API format to internal format
      const bookmarks = response.data.bookmarks.map((bm: TMarksBookmark) => ({
        url: bm.url,
        title: bm.title,
        description: bm.description || '',
        tags: bm.tags.map((tag: TMarksTag) => tag.name), // 只保留标签名称
        createdAt: new Date(bm.created_at).getTime(),
        remoteId: bm.id,
        isPublic: bm.is_public
      }));

      return {
        bookmarks,
        hasMore: response.data.meta.has_more,
        nextCursor: response.data.meta.next_cursor
      };
    } catch (error: any) {
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to fetch bookmarks: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Add a new bookmark
   * 
   * Note: We pass tag names directly via the `tags` field.
   * The backend will automatically create new tags if they don't exist.
   * This is more efficient than resolving tag IDs client-side (N+1 problem).
   */
  async addBookmark(bookmark: BookmarkInput): Promise<{ id: string }> {
    const client = await this.ensureClient();

    try {
      console.log('[BookmarkAPI] 保存书签:', bookmark.title);
      console.log('[BookmarkAPI] 标签:', bookmark.tags);

      const response = await client.bookmarks.createBookmark({
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description,
        cover_image: bookmark.thumbnail,
        tags: bookmark.tags, // Pass tag names directly, backend handles creation
        is_public: bookmark.isPublic ?? false
      });

      if (!response.data.bookmark) {
        throw new AppError(
          'BOOKMARK_SITE_ERROR' as ErrorCode,
          'Failed to add bookmark: No data returned'
        );
      }

      console.log('[BookmarkAPI] 书签创建成功, ID:', response.data.bookmark.id);
      return { id: response.data.bookmark.id };
    } catch (error: any) {
      throw new AppError(
        'BOOKMARK_SITE_ERROR' as ErrorCode,
        `Failed to add bookmark: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      await client.user.getMe(); // Test with a lightweight API call
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Find bookmark by exact URL match
   * Returns the bookmark if found, null otherwise
   */
  async findBookmarkByUrl(url: string): Promise<{ id: string; title: string } | null> {
    try {
      const client = await this.ensureClient();
      const bookmark = await client.bookmarks.findBookmarkByUrl(url);

      if (bookmark) {
        return { id: bookmark.id, title: bookmark.title };
      }
      return null;
    } catch (error) {
      console.error('[BookmarkAPI] Failed to find bookmark by URL:', error);
      return null;
    }
  }
}

// Singleton instance
export const bookmarkAPI = new BookmarkAPIClient();
