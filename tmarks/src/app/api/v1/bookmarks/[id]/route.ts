import { NextRequest } from 'next/server';
import { and, eq, isNull, isNotNull } from 'drizzle-orm';
import {
  badRequest,
  internalError,
  noContent,
  notFound,
  success,
} from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarkTags, bookmarks, tags } from '@/lib/db/schema';
import { deleteBookmarkAssets } from '@/lib/bookmarks/delete';
import { createOrLinkTags, getBookmarkTagIds, cleanupEmptyTags } from '@/lib/tags';
import {
  isValidUrl,
  sanitizeString,
} from '@/lib/validation';
import type { Bookmark, Tag } from '@/lib/types';

interface UpdateBookmarkRequest {
  title?: string;
  url?: string;
  description?: string | null;
  cover_image?: string | null;
  favicon?: string | null;
  tag_ids?: string[];
  tags?: string[];
  is_pinned?: boolean;
  is_archived?: boolean;
  is_public?: boolean;
}

function toApiBookmark(
  row: typeof bookmarks.$inferSelect,
  tagsForBookmark: Array<Pick<Tag, 'id' | 'name' | 'color'>> = [],
): Bookmark & { tags: Array<Pick<Tag, 'id' | 'name' | 'color'>> } {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    url: row.url,
    description: row.description,
    cover_image: row.coverImage,
    favicon: row.favicon,
    is_pinned: Boolean(row.isPinned),
    is_archived: Boolean(row.isArchived),
    is_public: Boolean(row.isPublic),
    click_count: Number(row.clickCount ?? 0),
    last_clicked_at: row.lastClickedAt,
    has_snapshot: Boolean(row.hasSnapshot),
    latest_snapshot_at: row.latestSnapshotAt,
    snapshot_count: Number(row.snapshotCount ?? 0),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    tags: tagsForBookmark,
  };
}

async function loadBookmarkWithTags(bookmarkId: string, userId: string, includeDeleted = false) {
  const bookmarkRow = await db.query.bookmarks.findFirst({
    where: includeDeleted
      ? and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId))
      : and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)),
  });

  if (!bookmarkRow) return null;

  const tagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
    .where(eq(bookmarkTags.bookmarkId, bookmarkId));

  return toApiBookmark(bookmarkRow, tagRows);
}

function getBookmarkId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  return segments[segments.length - 1] || '';
}

async function handleGet(_request: NextRequest, userId: string, bookmarkId: string) {
  const bookmark = await loadBookmarkWithTags(bookmarkId, userId);
  if (!bookmark) return notFound('Bookmark not found');
  return success({ bookmark });
}

async function handlePatch(request: NextRequest, userId: string, bookmarkId: string) {
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)),
  });

  if (!existing) return notFound('Bookmark not found');

  const body = (await request.json()) as UpdateBookmarkRequest;

  if (body.url && !isValidUrl(body.url)) {
    return badRequest('Invalid URL format');
  }

  const updates: Partial<typeof bookmarks.$inferInsert> = {};

  if (body.title !== undefined) updates.title = sanitizeString(body.title, 500);
  if (body.url !== undefined) updates.url = sanitizeString(body.url, 2000);
  if (body.description !== undefined) updates.description = body.description ? sanitizeString(body.description, 1000) : null;
  if (body.cover_image !== undefined) updates.coverImage = body.cover_image ? sanitizeString(body.cover_image, 2000) : null;
  if (body.favicon !== undefined) updates.favicon = body.favicon ? sanitizeString(body.favicon, 2000) : null;
  if (body.is_pinned !== undefined) updates.isPinned = Boolean(body.is_pinned);
  if (body.is_archived !== undefined) updates.isArchived = Boolean(body.is_archived);
  if (body.is_public !== undefined) updates.isPublic = Boolean(body.is_public);

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    await db.update(bookmarks).set(updates).where(eq(bookmarks.id, bookmarkId));
  }

  if (body.tags !== undefined) {
    await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));
    if (body.tags.length > 0) {
      await createOrLinkTags({ bookmarkId, tagNames: body.tags, userId });
    }
  } else if (body.tag_ids !== undefined) {
    await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));
    if (body.tag_ids.length > 0) {
      const now = new Date().toISOString();
      for (const tagId of body.tag_ids) {
        await db
          .insert(bookmarkTags)
          .values({ bookmarkId, tagId, userId, createdAt: now })
          .onConflictDoNothing({ target: [bookmarkTags.bookmarkId, bookmarkTags.tagId] });
      }
    }
  }

  const updated = await loadBookmarkWithTags(bookmarkId, userId);
  if (!updated) return internalError('Failed to load bookmark after update');

  return success({ bookmark: updated });
}

async function handleDelete(userId: string, bookmarkId: string) {
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)),
  });
  if (!existing) return notFound('Bookmark not found');

  // 获取书签关联的标签 IDs（在删除关联前）
  const tagIds = await getBookmarkTagIds(bookmarkId);

  const now = new Date().toISOString();
  await deleteBookmarkAssets(bookmarkId);
  await db
    .update(bookmarks)
    .set({
      deletedAt: now,
      updatedAt: now,
      clickCount: 0,
      lastClickedAt: null,
    })
    .where(eq(bookmarks.id, bookmarkId));

  await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));

  // 清理空标签
  await cleanupEmptyTags(userId, tagIds);

  return noContent();
}

async function handlePut(userId: string, bookmarkId: string) {
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)),
  });
  if (existing) {
    return success({ bookmark: await loadBookmarkWithTags(bookmarkId, userId) });
  }

  const deletedBookmark = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId), isNotNull(bookmarks.deletedAt)),
  });

  if (!deletedBookmark) {
    return notFound('Deleted bookmark not found');
  }

  await db
    .update(bookmarks)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(bookmarks.id, bookmarkId));

  const restored = await loadBookmarkWithTags(bookmarkId, userId);
  if (!restored) return internalError('Failed to load bookmark after restore');

  return success({ bookmark: restored });
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handleGet(request, ctx.userId, getBookmarkId(request))),
);

export const PATCH = withErrorHandling(
  withAuth(async (request, ctx) => {
    return handlePatch(request, ctx.userId, getBookmarkId(request));
  }),
);

export const DELETE = withErrorHandling(
  withAuth(async (request, ctx) => {
    return handleDelete(ctx.userId, getBookmarkId(request));
  }),
);

export const PUT = withErrorHandling(
  withAuth(async (request, ctx) => {
    return handlePut(ctx.userId, getBookmarkId(request));
  }),
);


