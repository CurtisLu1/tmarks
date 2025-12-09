import { NextRequest } from 'next/server';
import { and, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { badRequest, success } from '@/lib/api/response';
import { db } from '@/lib/db';
import { bookmarkTags, bookmarks, tags } from '@/lib/db/schema';

async function handleSearch(request: NextRequest, userId: string) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  if (!query) return badRequest('Search query is required');

  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
  const pattern = `%${query}%`;

  const bookmarkRows = await db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        isNull(bookmarks.deletedAt),
        or(
          ilike(bookmarks.title, pattern),
          ilike(bookmarks.description, pattern),
          ilike(bookmarks.url, pattern),
        ),
      ),
    )
    .orderBy(desc(bookmarks.isPinned), desc(bookmarks.updatedAt))
    .limit(limit);

  const bookmarkIds = bookmarkRows.map((b) => b.id);
  let tagRows: Array<{ bookmarkId: string; id: string; name: string; color: string | null }> = [];
  if (bookmarkIds.length > 0) {
    tagRows = await db
      .select({
        bookmarkId: bookmarkTags.bookmarkId,
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(inArray(bookmarkTags.bookmarkId, bookmarkIds));
  }

  const tagsByBookmark = new Map<string, typeof tagRows>();
  for (const row of tagRows) {
    const list = tagsByBookmark.get(row.bookmarkId) || [];
    list.push(row);
    tagsByBookmark.set(row.bookmarkId, list);
  }

  const tagsMatched = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      deletedAt: tags.deletedAt,
    })
    .from(tags)
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt), ilike(tags.name, pattern)))
    .limit(limit);

  return success({
    query,
    results: {
      bookmarks: bookmarkRows.map((b) => ({
        id: b.id,
        user_id: b.userId,
        title: b.title,
        url: b.url,
        description: b.description,
        cover_image: b.coverImage,
        favicon: b.favicon,
        is_pinned: Boolean(b.isPinned),
        is_archived: Boolean(b.isArchived),
        is_public: Boolean(b.isPublic),
        click_count: Number(b.clickCount ?? 0),
        last_clicked_at: b.lastClickedAt,
        has_snapshot: Boolean(b.hasSnapshot),
        latest_snapshot_at: b.latestSnapshotAt,
        snapshot_count: Number(b.snapshotCount ?? 0),
        created_at: b.createdAt,
        updated_at: b.updatedAt,
        tags: tagsByBookmark.get(b.id)?.map((t) => ({ id: t.id, name: t.name, color: t.color })) || [],
      })),
      tags: tagsMatched.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
        bookmark_count: undefined,
      })),
    },
    meta: {
      bookmark_count: bookmarkRows.length,
      tag_count: tagsMatched.length,
    },
  });
}

export const GET = withErrorHandling(withAuth(async (request, ctx) => handleSearch(request, ctx.userId)));


