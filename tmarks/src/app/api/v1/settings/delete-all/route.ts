import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { noContent, badRequest } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import {
    bookmarks,
    bookmarkTags,
    tags,
    tabGroups,
    tabGroupItems,
    shares,
    statistics,
} from '@/lib/db/schema';
import { deleteBookmarkAssets } from '@/lib/bookmarks/delete';

interface DeleteAllRequest {
    confirm_text?: string;
}

async function handlePost(request: NextRequest, userId: string) {
    const body = (await request.json()) as DeleteAllRequest;

    // Require confirmation text to prevent accidental deletion
    if (body.confirm_text !== 'DELETE ALL MY DATA') {
        return badRequest('Please confirm by providing confirm_text: "DELETE ALL MY DATA"');
    }

    // Get all bookmarks to delete their assets
    const userBookmarks = await db.query.bookmarks.findMany({
        where: eq(bookmarks.userId, userId),
    });

    // Delete assets for each bookmark (snapshots, cover images, etc.)
    for (const bookmark of userBookmarks) {
        await deleteBookmarkAssets(bookmark.id);
    }

    // Delete bookmark-tag associations
    await db.delete(bookmarkTags).where(eq(bookmarkTags.userId, userId));

    // Delete bookmarks
    await db.delete(bookmarks).where(eq(bookmarks.userId, userId));

    // Delete tags
    await db.delete(tags).where(eq(tags.userId, userId));

    // Delete shares
    await db.delete(shares).where(eq(shares.userId, userId));

    // Delete tab group items (via cascade through tabGroups, but explicit for safety)
    const userGroups = await db.query.tabGroups.findMany({
        where: eq(tabGroups.userId, userId),
        columns: { id: true },
    });
    for (const group of userGroups) {
        await db.delete(tabGroupItems).where(eq(tabGroupItems.groupId, group.id));
    }

    // Delete tab groups
    await db.delete(tabGroups).where(eq(tabGroups.userId, userId));

    // Delete statistics
    await db.delete(statistics).where(eq(statistics.userId, userId));

    return noContent();
}

export const POST = withErrorHandling(
    withAuth(async (request, ctx) => handlePost(request, ctx.userId))
);
