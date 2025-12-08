import { db } from '@/lib/db';
import { bookmarkAPI } from './bookmark-api';
import { tagRecommender } from './tag-recommender';
import { snapshotService } from './snapshot-service';
import { createTMarksClient } from '@/lib/api/tmarks';
import { StorageService } from '@/lib/utils/storage';
import { normalizeApiUrl, getTMarksUrls } from '@/lib/constants/urls';
import type { BookmarkInput, SaveResult } from '@/types';

export class BookmarkService {
  /**
   * Check if auto-snapshot is enabled in user preferences
   */
  private async shouldAutoSnapshot(): Promise<boolean> {
    try {
      const configuredUrl = await StorageService.getBookmarkSiteApiUrl();
      const apiKey = await StorageService.getBookmarkSiteApiKey();

      if (!apiKey) return false;

      const baseUrl = normalizeApiUrl(configuredUrl || getTMarksUrls().BASE_URL);
      const client = createTMarksClient({ apiKey, baseUrl });

      const settings = await client.user.getSnapshotSettings();
      return settings.autoCreate;
    } catch (error) {
      console.warn('[BookmarkService] Failed to check auto-snapshot setting:', error);
      return false;
    }
  }

  /**
   * Save bookmark to remote and local cache
   */
  async saveBookmark(bookmark: BookmarkInput): Promise<SaveResult> {
    try {
      // 1. Save to remote API
      const result = await bookmarkAPI.addBookmark(bookmark);

      // 2. Save to local cache
      await db.bookmarks.add({
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        tags: bookmark.tags,
        createdAt: Date.now(),
        remoteId: result.id,
        isPublic: bookmark.isPublic ?? false
      });

      // 3. Update tag usage counts
      await this.updateTagCounts(bookmark.tags);

      // 4. Update in-memory context cache for AI
      tagRecommender.updateContextWithBookmark({
        title: bookmark.title,
        tags: bookmark.tags
      });

      // 5. Auto-capture snapshot if enabled
      const autoSnapshotEnabled = await this.shouldAutoSnapshot();
      if (autoSnapshotEnabled && result.id) {
        console.log('[BookmarkService] Auto-snapshot enabled, capturing...');
        // Run snapshot capture in background, don't block the save result
        snapshotService.captureAndUpload(result.id).then((snapshotResult) => {
          if (snapshotResult.success) {
            console.log('[BookmarkService] Auto-snapshot captured successfully:', snapshotResult.snapshotId);
          } else {
            console.warn('[BookmarkService] Auto-snapshot failed:', snapshotResult.error);
          }
        }).catch((error) => {
          console.warn('[BookmarkService] Auto-snapshot error:', error);
        });
      }

      return {
        success: true,
        bookmarkId: result.id
      };
    } catch (error: any) {
      console.error('[BookmarkService] Failed to save bookmark:', error);

      // Check if it's a duplicate URL error
      if (error.message && error.message.includes('URL already exists')) {
        return {
          success: false,
          error: '该网址已经被收藏过了',
          message: '该网址已经被收藏过了'
        };
      }

      // Check if it's a network error
      if (error instanceof Error && error.message.includes('Network')) {
        // Queue for later sync
        await this.queueForLaterSync(bookmark);

        return {
          success: true,
          offline: true,
          message: '已暂存,将在网络恢复后同步'
        };
      }

      throw error;
    }
  }


  /**
   * Update tag usage counts in cache
   */
  private async updateTagCounts(tagNames: string[]): Promise<void> {
    for (const tagName of tagNames) {
      const existingTag = await db.tags.where('name').equals(tagName).first();

      if (existingTag && existingTag.id) {
        // Increment count
        await db.tags.update(existingTag.id, {
          count: (existingTag.count || 0) + 1
        });
      } else {
        // Create new tag
        await db.tags.add({
          name: tagName,
          count: 1,
          createdAt: Date.now()
        });
      }
    }
  }

  /**
   * Queue bookmark for later sync (offline mode)
   */
  private async queueForLaterSync(bookmark: BookmarkInput): Promise<void> {
    await db.metadata.add({
      key: `pending_${Date.now()}`,
      value: bookmark,
      updatedAt: Date.now()
    });

    console.log('[BookmarkService] Bookmark queued for later sync');
  }

  /**
   * Sync pending bookmarks (when back online)
   */
  async syncPendingBookmarks(): Promise<number> {
    const pending = await db.metadata
      .where('key')
      .startsWith('pending_')
      .toArray();

    let synced = 0;

    for (const item of pending) {
      try {
        await bookmarkAPI.addBookmark(item.value);
        await db.metadata.delete(item.key);
        synced++;
        console.log('[BookmarkService] Synced pending bookmark:', item.value.title);
      } catch (error) {
        console.error('[BookmarkService] Failed to sync pending bookmark:', error);
      }
    }

    console.log(`[BookmarkService] Synced ${synced}/${pending.length} pending bookmarks`);
    return synced;
  }

  /**
   * Get pending bookmarks count
   */
  async getPendingCount(): Promise<number> {
    const pending = await db.metadata
      .where('key')
      .startsWith('pending_')
      .count();

    return pending;
  }
}

// Singleton instance
export const bookmarkService = new BookmarkService();
