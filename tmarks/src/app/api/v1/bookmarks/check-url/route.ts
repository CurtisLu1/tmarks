import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { badRequest, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarks, bookmarkTags, tags } from '@/lib/db/schema';
import { isValidUrl } from '@/lib/validation';
import type { Bookmark, Tag } from '@/lib/types';

function toApiBookmark(
    row: typeof bookmarks.$inferSelect,
    tagsForBookmark: Array<Pick<Tag, 'id' | 'name' | 'color'>> = []
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

async function handleGet(request: NextRequest, userId: string) {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return badRequest('URL parameter is required');
    }

    if (!isValidUrl(url)) {
        return badRequest('Invalid URL format');
    }

    const existingBookmark = await db.query.bookmarks.findFirst({
        where: and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.url, url),
            isNull(bookmarks.deletedAt)
        ),
    });

    if (!existingBookmark) {
        return success({ exists: false });
    }

    // Load tags for the bookmark
    const tagRows = await db
        .select({
            id: tags.id,
            name: tags.name,
            color: tags.color,
        })
        .from(bookmarkTags)
        .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
        .where(eq(bookmarkTags.bookmarkId, existingBookmark.id));

    return success({
        exists: true,
        bookmark: toApiBookmark(existingBookmark, tagRows),
    });
}

export const GET = withErrorHandling(
    withAuth(async (request, ctx) => handleGet(request, ctx.userId))
);
