import { NextRequest } from 'next/server';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { badRequest, notFound, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarks, bookmarkTags } from '@/lib/db/schema';
import { deleteBookmarkAssets } from '@/lib/bookmarks/delete';

interface BulkActionRequest {
    action: 'pin' | 'unpin' | 'archive' | 'unarchive' | 'delete';
    ids: string[];
}

async function handlePatch(request: NextRequest, userId: string) {
    const body = (await request.json()) as BulkActionRequest;

    if (!body.action || !body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
        return badRequest('Invalid request: action and ids are required');
    }

    const validActions = ['pin', 'unpin', 'archive', 'unarchive', 'delete'];
    if (!validActions.includes(body.action)) {
        return badRequest(`Invalid action: ${body.action}. Valid actions: ${validActions.join(', ')}`);
    }

    // Verify all bookmarks belong to the user
    const existingBookmarks = await db.query.bookmarks.findMany({
        where: and(
            eq(bookmarks.userId, userId),
            inArray(bookmarks.id, body.ids),
            isNull(bookmarks.deletedAt)
        ),
    });

    if (existingBookmarks.length === 0) {
        return notFound('No valid bookmarks found');
    }

    const validIds = existingBookmarks.map((b) => b.id);
    const now = new Date().toISOString();

    switch (body.action) {
        case 'pin':
            await db
                .update(bookmarks)
                .set({ isPinned: true, updatedAt: now })
                .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.id, validIds)));
            break;

        case 'unpin':
            await db
                .update(bookmarks)
                .set({ isPinned: false, updatedAt: now })
                .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.id, validIds)));
            break;

        case 'archive':
            await db
                .update(bookmarks)
                .set({ isArchived: true, updatedAt: now })
                .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.id, validIds)));
            break;

        case 'unarchive':
            await db
                .update(bookmarks)
                .set({ isArchived: false, updatedAt: now })
                .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.id, validIds)));
            break;

        case 'delete':
            // Delete assets and soft delete bookmarks
            for (const id of validIds) {
                await deleteBookmarkAssets(id);
            }
            await db
                .update(bookmarks)
                .set({ deletedAt: now, updatedAt: now, clickCount: 0, lastClickedAt: null })
                .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.id, validIds)));
            // Remove tag associations
            await db.delete(bookmarkTags).where(inArray(bookmarkTags.bookmarkId, validIds));
            break;
    }

    return success({
        affected: validIds.length,
        action: body.action,
    });
}

export const PATCH = withErrorHandling(
    withAuth(async (request, ctx) => handlePatch(request, ctx.userId))
);
