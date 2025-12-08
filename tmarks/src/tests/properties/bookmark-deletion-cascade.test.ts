// @vitest-environment node
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { collectAssetKeys, deleteAssetsFromRecords } from '@/lib/bookmarks/delete';
import type { StorageProvider, UploadResult } from '@/lib/storage/interface';

vi.mock('@/lib/storage', () => {
  const mockStorage: StorageProvider = {
    async upload() {
      return { key: '', url: '', size: 0 };
    },
    async download() {
      return null;
    },
    async delete() {
      return;
    },
    async getSignedUrl() {
      return '';
    },
    async exists() {
      return false;
    },
  };
  return { storage: mockStorage };
});

class MockStorage implements StorageProvider {
  public deleted: string[] = [];
  // Unused methods for this test
  async upload(): Promise<UploadResult> {
    throw new Error('not implemented');
  }
  async download(): Promise<Buffer | null> {
    throw new Error('not implemented');
  }
  async getSignedUrl(): Promise<string> {
    return '';
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async delete(key: string): Promise<void> {
    this.deleted.push(key);
  }
}

// Feature: dokploy-migration
// Property 8: Bookmark Deletion Cascades to Files
// Validates: Requirements 4.3
describe('属性测试: 书签删除应级联删除存储文件', () => {
  it('应对重复/空键去重并删除唯一的资源键', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(fc.string({ minLength: 1, maxLength: 40 }), fc.constant(''), fc.constant(null)), {
          minLength: 1,
          maxLength: 8,
        }),
        async (keys) => {
          const records = keys.map((key) => ({ key }));
          const storage = new MockStorage();

          await deleteAssetsFromRecords(records as Array<{ key: string | null }>, storage);

          const expected = collectAssetKeys(records as Array<{ key: string | null }>);
          expect(storage.deleted.sort()).toEqual(expected.sort());
        },
      ),
      { numRuns: 50 },
    );
  });
});


