import { NextRequest } from 'next/server';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { badRequest, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarks, bookmarkTags, tags } from '@/lib/db/schema';
import { deleteBookmarkAssets } from '@/lib/bookmarks/delete';
import { createOrLinkTags } from '@/lib/tags';
import { isValidUrl, sanitizeString } from '@/lib/validation';
import type { Bookmark, Tag } from '@/lib/types';

interface CreateBookmarkInput {
    title: string;
    url: string;
    description?: string;
    cover_image?: string;
    tag_ids?: string[];
    tags?: string[];
    is_pinned?: boolean;
    is_archived?: boolean;
}

interface UpdateBookmarkInput {
    id: string;
    title?: string;
    url?: string;
    description?: string;
    cover_image?: string;
    tag_ids?: string[];
    tags?: string[];
    is_pinned?: boolean;
    is_archived?: boolean;
}

interface BatchCreateRequest {
    bookmarks: CreateBookmarkInput[];
    skip_duplicates?: boolean;
}

interface BatchUpdateRequest {
    updates: UpdateBookmarkInput[];
}

interface BatchDeleteRequest {
    ids: string[];
}

interface BatchResult {
    success: boolean;
    id?: string;
    url?: string;
    bookmark?: Bookmark & { tags: Array<Pick<Tag, 'id' | 'name' | 'color'>> };
    error?: { code: string; message: string };
}

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

async function loadBookmarkTags(bookmarkId: string) {
    return db
        .select({ id: tags.id, name: tags.name, color: tags.color })
        .from(bookmarkTags)
        .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
        .where(eq(bookmarkTags.bookmarkId, bookmarkId));
}

// POST: Batch create bookmarks
async function handlePost(request: NextRequest, userId: string) {
    const body = (await request.json()) as BatchCreateRequest;

    if (!body.bookmarks || !Array.isArray(body.bookmarks) || body.bookmarks.length === 0) {
        return badRequest('Invalid request: bookmarks array is required');
    }

    if (body.bookmarks.length > 100) {
        return badRequest('Maximum 100 bookmarks per batch request');
    }

    const skipDuplicates = body.skip_duplicates ?? true;
    const results: BatchResult[] = [];
    const now = new Date().toISOString();

    for (const input of body.bookmarks) {
        if (!input.url || !isValidUrl(input.url)) {
            results.push({
                success: false,
                url: input.url,
                error: { code: 'INVALID_URL', message: 'Invalid URL format' },
            });
            continue;
        }

        // Check for existing bookmark
        const existing = await db.query.bookmarks.findFirst({
            where: and(eq(bookmarks.userId, userId), eq(bookmarks.url, input.url), isNull(bookmarks.deletedAt)),
        });

        if (existing) {
            if (skipDuplicates) {
                const tagRows = await loadBookmarkTags(existing.id);
                results.push({ success: true, id: existing.id, url: input.url, bookmark: toApiBookmark(existing, tagRows) });
            } else {
                results.push({
                    success: false,
                    url: input.url,
                    error: { code: 'DUPLICATE_URL', message: 'Bookmark with this URL already exists' },
                });
            }
            continue;
        }

        // Create new bookmark
        const [newBookmark] = await db
            .insert(bookmarks)
            .values({
                userId,
                title: sanitizeString(input.title || input.url, 500),
                url: sanitizeString(input.url, 2000),
                description: input.description ? sanitizeString(input.description, 1000) : null,
                coverImage: input.cover_image ? sanitizeString(input.cover_image, 2000) : null,
                isPinned: Boolean(input.is_pinned),
                isArchived: Boolean(input.is_archived),
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        if (!newBookmark) {
            results.push({
                success: false,
                url: input.url,
                error: { code: 'INSERT_FAILED', message: 'Failed to create bookmark' },
            });
            continue;
        }

        // Handle tags
        if (input.tags && input.tags.length > 0) {
            await createOrLinkTags({ bookmarkId: newBookmark.id, tagNames: input.tags, userId });
        } else if (input.tag_ids && input.tag_ids.length > 0) {
            for (const tagId of input.tag_ids) {
                await db
                    .insert(bookmarkTags)
                    .values({ bookmarkId: newBookmark.id, tagId, userId, createdAt: now })
                    .onConflictDoNothing({ target: [bookmarkTags.bookmarkId, bookmarkTags.tagId] });
            }
        }

        const tagRows = await loadBookmarkTags(newBookmark.id);
        results.push({ success: true, id: newBookmark.id, url: input.url, bookmark: toApiBookmark(newBookmark, tagRows) });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return success({
        results,
        summary: { total: results.length, succeeded, failed },
    });
}

// PATCH: Batch update bookmarks
async function handlePatch(request: NextRequest, userId: string) {
    const body = (await request.json()) as BatchUpdateRequest;

    if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
        return badRequest('Invalid request: updates array is required');
    }

    if (body.updates.length > 100) {
        return badRequest('Maximum 100 updates per batch request');
    }

    const results: BatchResult[] = [];
    const now = new Date().toISOString();

    for (const input of body.updates) {
        if (!input.id) {
            results.push({
                success: false,
                error: { code: 'MISSING_ID', message: 'Bookmark ID is required' },
            });
            continue;
        }

        const existing = await db.query.bookmarks.findFirst({
            where: and(eq(bookmarks.id, input.id), eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)),
        });

        if (!existing) {
            results.push({
                success: false,
                id: input.id,
                error: { code: 'NOT_FOUND', message: 'Bookmark not found' },
            });
            continue;
        }

        const updates: Partial<typeof bookmarks.$inferInsert> = { updatedAt: now };

        if (input.title !== undefined) updates.title = sanitizeString(input.title, 500);
        if (input.url !== undefined && isValidUrl(input.url)) updates.url = sanitizeString(input.url, 2000);
        if (input.description !== undefined) updates.description = input.description ? sanitizeString(input.description, 1000) : null;
        if (input.cover_image !== undefined) updates.coverImage = input.cover_image ? sanitizeString(input.cover_image, 2000) : null;
        if (input.is_pinned !== undefined) updates.isPinned = Boolean(input.is_pinned);
        if (input.is_archived !== undefined) updates.isArchived = Boolean(input.is_archived);

        await db.update(bookmarks).set(updates).where(eq(bookmarks.id, input.id));

        // Handle tags
        if (input.tags !== undefined) {
            await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, input.id));
            if (input.tags.length > 0) {
                await createOrLinkTags({ bookmarkId: input.id, tagNames: input.tags, userId });
            }
        } else if (input.tag_ids !== undefined) {
            await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, input.id));
            for (const tagId of input.tag_ids) {
                await db
                    .insert(bookmarkTags)
                    .values({ bookmarkId: input.id, tagId, userId, createdAt: now })
                    .onConflictDoNothing({ target: [bookmarkTags.bookmarkId, bookmarkTags.tagId] });
            }
        }

        const updated = await db.query.bookmarks.findFirst({ where: eq(bookmarks.id, input.id) });
        const tagRows = await loadBookmarkTags(input.id);
        results.push({ success: true, id: input.id, bookmark: updated ? toApiBookmark(updated, tagRows) : undefined });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return success({
        results,
        summary: { total: results.length, succeeded, failed },
    });
}

// DELETE: Batch delete bookmarks
async function handleDelete(request: NextRequest, userId: string) {
    const body = (await request.json()) as BatchDeleteRequest;

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
        return badRequest('Invalid request: ids array is required');
    }

    if (body.ids.length > 100) {
        return badRequest('Maximum 100 deletions per batch request');
    }

    const results: BatchResult[] = [];
    const now = new Date().toISOString();

    // Verify all bookmarks belong to the user
    const existingBookmarks = await db.query.bookmarks.findMany({
        where: and(eq(bookmarks.userId, userId), inArray(bookmarks.id, body.ids), isNull(bookmarks.deletedAt)),
    });

    const validIds = new Set(existingBookmarks.map((b) => b.id));

    for (const id of body.ids) {
        if (!validIds.has(id)) {
            results.push({
                success: false,
                id,
                error: { code: 'NOT_FOUND', message: 'Bookmark not found' },
            });
            continue;
        }

        await deleteBookmarkAssets(id);
        await db
            .update(bookmarks)
            .set({ deletedAt: now, updatedAt: now, clickCount: 0, lastClickedAt: null })
            .where(eq(bookmarks.id, id));
        await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));

        results.push({ success: true, id });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return success({
        results,
        summary: { total: results.length, succeeded, failed },
    });
}

export const POST = withErrorHandling(
    withAuth(async (request, ctx) => handlePost(request, ctx.userId))
);

export const PATCH = withErrorHandling(
    withAuth(async (request, ctx) => handlePatch(request, ctx.userId))
);

export const DELETE = withErrorHandling(
    withAuth(async (request, ctx) => handleDelete(request, ctx.userId))
);
