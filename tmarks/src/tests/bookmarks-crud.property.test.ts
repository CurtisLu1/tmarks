import { assert, asyncProperty, array, boolean, option, record, string } from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Bookmark, CreateBookmarkRequest, UpdateBookmarkRequest } from '@/lib/types';
import { bookmarksService } from '@/services/bookmarks';

const store = vi.hoisted<Record<string, Bookmark>>(() => ({}));
const apiClientSpies = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: apiClientSpies,
}));

const now = () => new Date().toISOString();

function createBookmarkEntity(id: string, data: CreateBookmarkRequest): Bookmark {
  const uniqueTags = Array.from(new Set(data.tag_ids ?? []));
  const createdAt = now();
  return {
    id,
    user_id: 'user-1',
    title: data.title,
    url: data.url,
    description: data.description ?? null,
    cover_image: data.cover_image ?? null,
    favicon: data.favicon ?? null,
    is_pinned: data.is_pinned ?? false,
    is_archived: data.is_archived ?? false,
    is_public: data.is_public ?? false,
    click_count: 0,
    last_clicked_at: null,
    has_snapshot: false,
    latest_snapshot_at: null,
    snapshot_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
    tags: uniqueTags.map((idValue) => ({
      id: idValue,
      name: idValue,
      color: null,
    })),
  };
}

beforeEach(() => {
  Object.keys(store).forEach((key) => delete store[key]);
  apiClientSpies.get.mockReset();
  apiClientSpies.post.mockReset();
  apiClientSpies.patch.mockReset();
  apiClientSpies.delete.mockReset();

  apiClientSpies.post.mockImplementation(
    async (path: string, body: CreateBookmarkRequest) => {
      if (path !== '/bookmarks') {
        throw new Error(`unexpected POST path ${path}`);
      }
      const id = crypto.randomUUID?.() ?? `bookmark-${Date.now()}`;
      const bookmark = createBookmarkEntity(id, body);
      store[id] = bookmark;
      return { data: { bookmark } };
    },
  );

  apiClientSpies.patch.mockImplementation(
    async (path: string, body: UpdateBookmarkRequest) => {
      const [basePath] = path.split('?');
      if (!basePath?.startsWith('/bookmarks/')) {
        throw new Error(`unexpected PATCH path ${path}`);
      }
      const id = basePath.replace('/bookmarks/', '');
      const current = store[id];
      if (!current) {
        throw new Error('bookmark not found');
      }
      const nextTags = body.tag_ids ?? current.tags.map((t) => t.id);
      const updated: Bookmark = {
        ...current,
        title: body.title ?? current.title,
        url: body.url ?? current.url,
        description:
          body.description !== undefined ? body.description : current.description,
        cover_image:
          body.cover_image !== undefined ? body.cover_image : current.cover_image,
        favicon:
          body.favicon !== undefined ? body.favicon : current.favicon,
        is_pinned: body.is_pinned ?? current.is_pinned,
        is_archived: body.is_archived ?? current.is_archived,
        is_public: body.is_public ?? current.is_public,
        updated_at: now(),
        tags: nextTags.map((tagId) => ({
          id: tagId,
          name: tagId,
          color: null,
        })),
      };
      store[id] = updated;
      return { data: { bookmark: updated } };
    },
  );

  apiClientSpies.delete.mockImplementation(async (path: string) => {
    const [basePath] = path.split('?');
    if (!basePath?.startsWith('/bookmarks/')) {
      throw new Error(`unexpected DELETE path ${path}`);
    }
    const id = basePath.replace('/bookmarks/', '');
    delete store[id];
    return { data: null };
  });

  apiClientSpies.get.mockImplementation(async (path: string) => {
    const [basePath] = path.split('?');
    if (basePath !== '/bookmarks') {
      throw new Error(`unexpected GET path ${path}`);
    }
    const bookmarks = Object.values(store);
    return {
      data: {
        bookmarks,
        meta: {
          page_size: 30,
          count: bookmarks.length,
          has_more: false,
          next_cursor: undefined,
        },
      },
    };
  });
});

describe('Property 8: 书签 CRUD 操作', () => {
  it('创建 -> 更新 -> 删除后状态保持一致', async () => {
    await assert(
      asyncProperty(
        record({
          title: string({ minLength: 4, maxLength: 48 }),
          urlSlug: string({ minLength: 6, maxLength: 18 }),
          description: option(string({ maxLength: 80 }), { nil: undefined }),
          cover: option(string({ maxLength: 80 }), { nil: undefined }),
          tags: array(string({ minLength: 3, maxLength: 12 }), { minLength: 0, maxLength: 4 }),
          flags: record({
            is_pinned: boolean(),
            is_archived: boolean(),
            is_public: boolean(),
          }),
          update: record({
            title: option(string({ minLength: 4, maxLength: 48 }), { nil: undefined }),
            description: option(string({ maxLength: 80 }), { nil: undefined }),
            cover: option(string({ maxLength: 80 }), { nil: undefined }),
            tagIds: option(array(string({ minLength: 3, maxLength: 12 }), { minLength: 0, maxLength: 4 }), {
              nil: undefined,
            }),
            flags: record({
              is_pinned: boolean(),
              is_archived: boolean(),
              is_public: boolean(),
            }),
          }),
        }),
        async (input) => {
          const uniqueTags = Array.from(new Set(input.tags));
          const createData: CreateBookmarkRequest = {
            title: input.title,
            url: `https://example.com/${encodeURIComponent(input.urlSlug)}`,
            description: input.description?.trim() || undefined,
            cover_image: input.cover?.trim() || undefined,
            tag_ids: uniqueTags,
            is_pinned: input.flags.is_pinned,
            is_archived: input.flags.is_archived,
            is_public: input.flags.is_public,
          };

          const created = await bookmarksService.createBookmark(createData);
          expect(created.title).toBe(createData.title);
          expect(created.url).toBe(createData.url);
          expect(created.tags.map((t) => t.id)).toEqual(uniqueTags);
          expect(created.is_pinned).toBe(createData.is_pinned);
          expect(created.is_archived).toBe(createData.is_archived);
          expect(created.is_public).toBe(createData.is_public);

          const nextTagIds = input.update.tagIds
            ? Array.from(new Set(input.update.tagIds))
            : undefined;
          const updateData: UpdateBookmarkRequest = {
            title: input.update.title ?? undefined,
            description:
              input.update.description === undefined
                ? undefined
                : input.update.description.trim() === ''
                  ? null
                  : input.update.description.trim(),
            cover_image:
              input.update.cover === undefined
                ? undefined
                : input.update.cover.trim() === ''
                  ? null
                  : input.update.cover.trim(),
            tag_ids: nextTagIds,
            is_pinned: input.update.flags.is_pinned,
            is_archived: input.update.flags.is_archived,
            is_public: input.update.flags.is_public,
          };

          const updated = await bookmarksService.updateBookmark(created.id, updateData);

          const expectedTitle = updateData.title ?? createData.title;
          const expectedDescription =
            updateData.description !== undefined ? updateData.description : createData.description ?? null;
          const expectedCover =
            updateData.cover_image !== undefined ? updateData.cover_image : createData.cover_image ?? null;
          const expectedTags = nextTagIds ?? uniqueTags;

          expect(updated.title).toBe(expectedTitle);
          expect(updated.description).toBe(expectedDescription ?? null);
          expect(updated.cover_image).toBe(expectedCover ?? null);
          expect(updated.tags.map((t) => t.id)).toEqual(expectedTags);
          expect(updated.is_pinned).toBe(updateData.is_pinned ?? createData.is_pinned ?? false);
          expect(updated.is_archived).toBe(updateData.is_archived ?? createData.is_archived ?? false);
          expect(updated.is_public).toBe(updateData.is_public ?? createData.is_public ?? false);

          await bookmarksService.deleteBookmark(created.id);
          const list = await bookmarksService.getBookmarks();
          expect(list.bookmarks.find((item) => item.id === created.id)).toBeUndefined();
          expect(list.meta.count).toBe(Object.keys(store).length);
        },
      ),
      { numRuns: 25 },
    );
  });
});

