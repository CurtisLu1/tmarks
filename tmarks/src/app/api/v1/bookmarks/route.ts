import { NextRequest } from 'next/server';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  or,
} from 'drizzle-orm';
import {
  badRequest,
  created,
  internalError,
  success,
} from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import {
  bookmarkSnapshots,
  bookmarkTags,
  bookmarks,
  tags,
} from '@/lib/db/schema';
import { generateUUID } from '@/lib/crypto';
import { createOrLinkTags } from '@/lib/tags';
import {
  isValidUrl,
  sanitizeString,
} from '@/lib/validation';
import type { ApiResponse, Bookmark, Tag } from '@/lib/types';

interface BookmarkListQuery {
  keyword?: string;
  tags?: string[];
  pageSize: number;
  pageCursor?: string;
  sort?: 'created' | 'updated' | 'pinned' | 'popular';
  archived?: boolean;
  pinned?: boolean;
}

interface CreateBookmarkRequest {
  title: string;
  url: string;
  description?: string;
  cover_image?: string;
  favicon?: string;
  tag_ids?: string[];
  tags?: string[];
  is_pinned?: boolean;
  is_archived?: boolean;
  is_public?: boolean;
}

interface BookmarkWithTags extends Bookmark {
  tags: Array<Pick<Tag, 'id' | 'name' | 'color'>>;
}

function buildAnd(conditions: Array<ReturnType<typeof and> | ReturnType<typeof or> | undefined>) {
  const filtered = conditions.filter(Boolean) as Array<ReturnType<typeof and> | ReturnType<typeof or>>;
  if (filtered.length === 0) return undefined;
  return filtered.reduce((acc, cur) => (acc ? and(acc, cur) : cur));
}

function toApiBookmark(
  row: typeof bookmarks.$inferSelect,
  tagsForBookmark: Array<Pick<Tag, 'id' | 'name' | 'color'>> = [],
  snapshotCount = 0,
): BookmarkWithTags {
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
    snapshot_count: snapshotCount ?? Number(row.snapshotCount ?? 0),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    tags: tagsForBookmark,
  };
}

function getOrderBy(sort?: string) {
  switch (sort) {
    case 'updated':
      return [desc(bookmarks.isPinned), desc(bookmarks.updatedAt), desc(bookmarks.id)];
    case 'pinned':
      return [desc(bookmarks.isPinned), desc(bookmarks.createdAt), desc(bookmarks.id)];
    case 'popular':
      return [
        desc(bookmarks.isPinned),
        desc(bookmarks.clickCount),
        desc(bookmarks.lastClickedAt),
        desc(bookmarks.id),
      ];
    case 'created':
    default:
      return [desc(bookmarks.isPinned), desc(bookmarks.createdAt), desc(bookmarks.id)];
  }
}

async function fetchBookmarks(userId: string, query: BookmarkListQuery) {
  const conditions = [
    eq(bookmarks.userId, userId),
    isNull(bookmarks.deletedAt),
    eq(bookmarks.isArchived, Boolean(query.archived)),
    query.pinned ? eq(bookmarks.isPinned, true) : undefined,
    query.keyword
      ? or(
        ilike(bookmarks.title, `%${query.keyword}%`),
        ilike(bookmarks.url, `%${query.keyword}%`),
        ilike(bookmarks.description, `%${query.keyword}%`),
      )
      : undefined,
    query.pageCursor ? lt(bookmarks.createdAt, query.pageCursor) : undefined,
  ];

  const orderBy = getOrderBy(query.sort);
  const baseWhere = buildAnd(conditions);

  let idRows: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    isPinned: boolean;
    clickCount: number | null;
    lastClickedAt: string | null;
  }> = [];

  if (query.tags && query.tags.length > 0) {
    idRows = await db
      .select({
        id: bookmarks.id,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        isPinned: bookmarks.isPinned,
        clickCount: bookmarks.clickCount,
        lastClickedAt: bookmarks.lastClickedAt,
      })
      .from(bookmarks)
      .innerJoin(bookmarkTags, eq(bookmarkTags.bookmarkId, bookmarks.id))
      .where(
        buildAnd([
          baseWhere,
          inArray(bookmarkTags.tagId, query.tags),
        ])!,
      )
      .groupBy(
        bookmarks.id,
        bookmarks.createdAt,
        bookmarks.updatedAt,
        bookmarks.isPinned,
        bookmarks.clickCount,
        bookmarks.lastClickedAt,
      )
      .having(eq(countDistinct(bookmarkTags.tagId), query.tags.length))
      .orderBy(...orderBy)
      .limit(query.pageSize + 1);
  } else {
    idRows = await db
      .select({
        id: bookmarks.id,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        isPinned: bookmarks.isPinned,
        clickCount: bookmarks.clickCount,
        lastClickedAt: bookmarks.lastClickedAt,
      })
      .from(bookmarks)
      .where(baseWhere!)
      .orderBy(...orderBy)
      .limit(query.pageSize + 1);
  }

  const hasMore = idRows.length > query.pageSize;
  const slicedIds = idRows.slice(0, query.pageSize).map((row) => row.id);
  if (slicedIds.length === 0) {
    return { bookmarks: [], meta: { page_size: query.pageSize, count: 0, next_cursor: null, has_more: false } };
  }

  const idOrder = new Map<string, number>();
  slicedIds.forEach((id, idx) => idOrder.set(id, idx));

  const bookmarkRows = await db
    .select()
    .from(bookmarks)
    .where(inArray(bookmarks.id, slicedIds));

  const tagRows = await db
    .select({
      bookmarkId: bookmarkTags.bookmarkId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
    .where(inArray(bookmarkTags.bookmarkId, slicedIds))
    .orderBy(bookmarkTags.bookmarkId, tags.name);

  const snapshotRows = await db
    .select({
      bookmarkId: bookmarkSnapshots.bookmarkId,
      count: count(bookmarkSnapshots.id),
    })
    .from(bookmarkSnapshots)
    .where(inArray(bookmarkSnapshots.bookmarkId, slicedIds))
    .groupBy(bookmarkSnapshots.bookmarkId);

  const tagsByBookmark = new Map<string, Array<Pick<Tag, 'id' | 'name' | 'color'>>>();
  for (const row of tagRows) {
    const list = tagsByBookmark.get(row.bookmarkId) || [];
    list.push({ id: row.id, name: row.name, color: row.color });
    tagsByBookmark.set(row.bookmarkId, list);
  }

  const snapshotCounts = new Map<string, number>();
  for (const row of snapshotRows) {
    snapshotCounts.set(row.bookmarkId, Number(row.count));
  }

  const sorted = bookmarkRows.sort((a, b) => (idOrder.get(a.id)! - idOrder.get(b.id)!));
  const data = sorted.map((row) =>
    toApiBookmark(row, tagsByBookmark.get(row.id) || [], snapshotCounts.get(row.id) || 0),
  );

  return {
    bookmarks: data,
    meta: {
      page_size: query.pageSize,
      count: data.length,
      next_cursor: hasMore ? idRows[query.pageSize]?.createdAt ?? null : null,
      has_more: hasMore,
    },
  };
}

async function handleGet(request: NextRequest, userId: string) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || undefined;
  const tagIds = url.searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('page_size') || '30', 10), 1), 100);
  const pageCursor = url.searchParams.get('page_cursor') || undefined;
  const sort = (url.searchParams.get('sort') as BookmarkListQuery['sort']) || 'created';
  const isArchived = url.searchParams.get('archived') === 'true';
  const isPinned = url.searchParams.get('pinned') === 'true';

  const result = await fetchBookmarks(userId, {
    keyword,
    tags: tagIds.length ? tagIds : undefined,
    pageSize,
    pageCursor,
    sort,
    archived: isArchived,
    pinned: isPinned,
  });

  return success(result as ApiResponse['data']);
}

async function handlePost(request: NextRequest, userId: string) {
  const body = (await request.json()) as CreateBookmarkRequest;

  if (!body.title || !body.url) {
    return badRequest('Title and URL are required');
  }

  if (!isValidUrl(body.url)) {
    return badRequest('Invalid URL format');
  }

  const title = sanitizeString(body.title, 500);
  const url = sanitizeString(body.url, 2000);
  const description = body.description ? sanitizeString(body.description, 1000) : null;
  const coverImage = body.cover_image ? sanitizeString(body.cover_image, 2000) : null;
  const favicon = body.favicon ? sanitizeString(body.favicon, 2000) : null;
  const isPinned = Boolean(body.is_pinned);
  const isArchived = Boolean(body.is_archived);
  const isPublic = Boolean(body.is_public);
  const now = new Date().toISOString();

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.url, url)),
  });

  let bookmarkId: string;

  if (existing) {
    bookmarkId = existing.id;

    if (!existing.deletedAt) {
      const bookmarkTagsRows = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(bookmarkTags)
        .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
        .where(eq(bookmarkTags.bookmarkId, bookmarkId));

      return success(
        {
          bookmark: toApiBookmark(existing, bookmarkTagsRows),
          code: 'BOOKMARK_EXISTS',
          message: 'Bookmark already exists',
        },
      );
    }

    await db
      .update(bookmarks)
      .set({
        title,
        description,
        coverImage,
        coverImageId: null,
        favicon,
        isPinned,
        isArchived,
        isPublic,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(bookmarks.id, bookmarkId));

    await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));
  } else {
    bookmarkId = generateUUID();
    await db.insert(bookmarks).values({
      id: bookmarkId,
      userId,
      title,
      url,
      description,
      coverImage,
      coverImageId: null,
      favicon,
      isPinned,
      isArchived,
      isPublic,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (body.tags && body.tags.length > 0) {
    await createOrLinkTags({ bookmarkId, tagNames: body.tags, userId });
  } else if (body.tag_ids && body.tag_ids.length > 0) {
    for (const tagId of body.tag_ids) {
      await db
        .insert(bookmarkTags)
        .values({ bookmarkId, tagId, userId, createdAt: now })
        .onConflictDoNothing({ target: [bookmarkTags.bookmarkId, bookmarkTags.tagId] });
    }
  }

  const savedBookmark = await db.query.bookmarks.findFirst({
    where: eq(bookmarks.id, bookmarkId),
  });

  const tagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
    .where(eq(bookmarkTags.bookmarkId, bookmarkId));

  if (!savedBookmark) {
    return internalError('Failed to load bookmark after creation');
  }

  return created({
    bookmark: toApiBookmark(savedBookmark, tagRows),
  });
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handleGet(request, ctx.userId)),
);

export const POST = withErrorHandling(
  withAuth(async (request, ctx) => handlePost(request, ctx.userId)),
);


