import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import {
    noContent,
    notFound,
} from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarks, bookmarkSnapshots } from '@/lib/db/schema';
import { storage } from '@/lib/storage';

function getParams(request: NextRequest): { bookmarkId: string; snapshotId: string } {
    const segments = request.nextUrl.pathname.split('/');
    const bookmarksIndex = segments.indexOf('bookmarks');
    const snapshotsIndex = segments.indexOf('snapshots');

    return {
        bookmarkId: segments[bookmarksIndex + 1] || '',
        snapshotId: segments[snapshotsIndex + 1] || '',
    };
}

/**
 * DELETE /api/v1/bookmarks/[id]/snapshots/[snapshotId]
 * Delete a specific snapshot
 */
async function handleDelete(request: NextRequest, userId: string) {
    const { bookmarkId, snapshotId } = getParams(request);

    // Verify bookmark exists and belongs to user
    const bookmark = await db.query.bookmarks.findFirst({
        where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)),
    });

    if (!bookmark) {
        return notFound('Bookmark not found');
    }

    // Find the snapshot
    const snapshot = await db.query.bookmarkSnapshots.findFirst({
        where: and(
            eq(bookmarkSnapshots.id, snapshotId),
            eq(bookmarkSnapshots.bookmarkId, bookmarkId),
            eq(bookmarkSnapshots.userId, userId)
        ),
    });

    if (!snapshot) {
        return notFound('Snapshot not found');
    }

    // Delete from storage
    try {
        await storage.delete(snapshot.r2Key);
    } catch (error) {
        console.warn('Failed to delete snapshot from storage:', snapshot.r2Key, error);
        // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await db.delete(bookmarkSnapshots).where(eq(bookmarkSnapshots.id, snapshotId));

    // Update bookmark snapshot count
    const remainingCount = await db
        .select()
        .from(bookmarkSnapshots)
        .where(eq(bookmarkSnapshots.bookmarkId, bookmarkId));

    const now = new Date().toISOString();

    if (remainingCount.length === 0) {
        // No more snapshots
        await db
            .update(bookmarks)
            .set({
                hasSnapshot: false,
                latestSnapshotAt: null,
                snapshotCount: 0,
                updatedAt: now,
            })
            .where(eq(bookmarks.id, bookmarkId));
    } else {
        // Update count and find new latest
        const latestSnapshot = remainingCount.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        // If we deleted the latest, mark another as latest
        if (snapshot.isLatest && latestSnapshot) {
            await db
                .update(bookmarkSnapshots)
                .set({ isLatest: true })
                .where(eq(bookmarkSnapshots.id, latestSnapshot.id));
        }

        await db
            .update(bookmarks)
            .set({
                snapshotCount: remainingCount.length,
                latestSnapshotAt: latestSnapshot?.createdAt ?? null,
                updatedAt: now,
            })
            .where(eq(bookmarks.id, bookmarkId));
    }

    return noContent();
}

export const DELETE = withErrorHandling(
    withAuth(async (request, ctx) => handleDelete(request, ctx.userId))
);
