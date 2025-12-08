import { NextRequest } from 'next/server';
import { and, count, desc, eq } from 'drizzle-orm';
import {
    badRequest,
    created,
    notFound,
    success,
} from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarks, bookmarkSnapshots } from '@/lib/db/schema';
import { storage } from '@/lib/storage';
import { generateUUID } from '@/lib/crypto';
import crypto from 'crypto';

interface CreateSnapshotRequest {
    image: string; // base64 data URL: "data:image/png;base64,..."
}

interface SnapshotResponse {
    id: string;
    version: number;
    file_size: number;
    snapshot_title: string;
    created_at: string;
    view_url: string;
}

function getBookmarkId(request: NextRequest): string {
    const segments = request.nextUrl.pathname.split('/');
    const idIndex = segments.indexOf('bookmarks') + 1;
    return segments[idIndex] || '';
}

/**
 * GET /api/v1/bookmarks/[id]/snapshots
 * Get all snapshots for a bookmark
 */
async function handleGet(request: NextRequest, userId: string) {
    const bookmarkId = getBookmarkId(request);

    // Verify bookmark exists and belongs to user
    const bookmark = await db.query.bookmarks.findFirst({
        where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)),
    });

    if (!bookmark) {
        return notFound('Bookmark not found');
    }

    // Get all snapshots for this bookmark
    const snapshotRows = await db
        .select()
        .from(bookmarkSnapshots)
        .where(eq(bookmarkSnapshots.bookmarkId, bookmarkId))
        .orderBy(desc(bookmarkSnapshots.version));

    // Generate signed URLs for each snapshot
    const snapshots: SnapshotResponse[] = await Promise.all(
        snapshotRows.map(async (row) => {
            const viewUrl = await storage.getSignedUrl(row.r2Key, 3600);
            return {
                id: row.id,
                version: row.version,
                file_size: row.fileSize,
                snapshot_title: row.snapshotTitle,
                created_at: row.createdAt,
                view_url: viewUrl,
            };
        })
    );

    return success({
        snapshots,
        total: snapshots.length,
    });
}

/**
 * POST /api/v1/bookmarks/[id]/snapshots
 * Create a new snapshot from screenshot
 */
async function handlePost(request: NextRequest, userId: string) {
    const bookmarkId = getBookmarkId(request);

    // Verify bookmark exists and belongs to user
    const bookmark = await db.query.bookmarks.findFirst({
        where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)),
    });

    if (!bookmark) {
        return notFound('Bookmark not found');
    }

    const body = (await request.json()) as CreateSnapshotRequest;

    if (!body.image || !body.image.startsWith('data:image/')) {
        return badRequest('Invalid image data. Expected base64 data URL.');
    }

    // Parse base64 data URL
    const matches = body.image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches || !matches[2]) {
        return badRequest('Invalid base64 image format');
    }

    const imageFormat = matches[1]; // png, jpeg, etc.
    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Calculate content hash for deduplication
    const contentHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

    // Check if a snapshot with the same content already exists
    const existingSnapshot = await db.query.bookmarkSnapshots.findFirst({
        where: and(
            eq(bookmarkSnapshots.bookmarkId, bookmarkId),
            eq(bookmarkSnapshots.contentHash, contentHash)
        ),
    });

    if (existingSnapshot) {
        // Return existing snapshot instead of creating duplicate
        const viewUrl = await storage.getSignedUrl(existingSnapshot.r2Key, 3600);
        return success({
            snapshot: {
                id: existingSnapshot.id,
                version: existingSnapshot.version,
                file_size: existingSnapshot.fileSize,
                snapshot_title: existingSnapshot.snapshotTitle,
                created_at: existingSnapshot.createdAt,
                view_url: viewUrl,
            },
            deduplicated: true,
        });
    }

    // Get next version number
    const [versionResult] = await db
        .select({ maxVersion: count(bookmarkSnapshots.id) })
        .from(bookmarkSnapshots)
        .where(eq(bookmarkSnapshots.bookmarkId, bookmarkId));

    const nextVersion = (versionResult?.maxVersion ?? 0) + 1;

    // Generate storage key
    const snapshotId = generateUUID();
    const r2Key = `snapshots/${userId}/${bookmarkId}/${snapshotId}.${imageFormat}`;

    // Upload to MinIO
    const uploadResult = await storage.upload(r2Key, imageBuffer, {
        contentType: `image/${imageFormat}`,
        metadata: {
            bookmarkId,
            userId,
            version: String(nextVersion),
        },
    });

    const now = new Date().toISOString();

    // Mark previous latest as not latest
    await db
        .update(bookmarkSnapshots)
        .set({ isLatest: false })
        .where(and(
            eq(bookmarkSnapshots.bookmarkId, bookmarkId),
            eq(bookmarkSnapshots.isLatest, true)
        ));

    // Create snapshot record
    await db.insert(bookmarkSnapshots).values({
        id: snapshotId,
        bookmarkId,
        userId,
        version: nextVersion,
        isLatest: true,
        contentHash,
        r2Key,
        r2Bucket: 'tmarks',
        fileSize: imageBuffer.length,
        mimeType: `image/${imageFormat}`,
        snapshotUrl: bookmark.url,
        snapshotTitle: bookmark.title,
        snapshotStatus: 'completed',
        createdAt: now,
        updatedAt: now,
    });

    // Update bookmark snapshot metadata
    await db
        .update(bookmarks)
        .set({
            hasSnapshot: true,
            latestSnapshotAt: now,
            snapshotCount: nextVersion,
            updatedAt: now,
        })
        .where(eq(bookmarks.id, bookmarkId));

    const viewUrl = await storage.getSignedUrl(r2Key, 3600);

    return created({
        snapshot: {
            id: snapshotId,
            version: nextVersion,
            file_size: uploadResult.size,
            snapshot_title: bookmark.title,
            created_at: now,
            view_url: viewUrl,
        },
    });
}

export const GET = withErrorHandling(
    withAuth(async (request, ctx) => handleGet(request, ctx.userId))
);

export const POST = withErrorHandling(
    withAuth(async (request, ctx) => handlePost(request, ctx.userId))
);
