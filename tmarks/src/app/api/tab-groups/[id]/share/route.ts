import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { noContent, notFound, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { tabGroups, shares } from '@/lib/db/schema';

function getGroupId(request: NextRequest): string {
    const segments = request.nextUrl.pathname.split('/');
    const groupsIndex = segments.findIndex((s) => s === 'tab-groups');
    return segments[groupsIndex + 1] || '';
}

function generateShareToken(): string {
    return randomBytes(16).toString('hex');
}

// POST: Create share link
async function handlePost(request: NextRequest, userId: string) {
    const groupId = getGroupId(request);

    // Verify group exists and belongs to user
    const group = await db.query.tabGroups.findFirst({
        where: and(eq(tabGroups.id, groupId), eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)),
    });

    if (!group) {
        return notFound('Tab group not found');
    }

    // Check if share already exists
    const existingShare = await db.query.shares.findFirst({
        where: and(eq(shares.groupId, groupId), eq(shares.userId, userId)),
    });

    if (existingShare) {
        return success({
            share: {
                id: existingShare.id,
                share_token: existingShare.shareToken,
                share_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${existingShare.shareToken}`,
                is_public: existingShare.isPublic,
                view_count: existingShare.viewCount,
                created_at: existingShare.createdAt,
                expires_at: existingShare.expiresAt,
            },
        });
    }

    const body = await request.json().catch(() => ({})) as { is_public?: boolean; expires_in_days?: number };
    const now = new Date().toISOString();
    const shareToken = generateShareToken();

    let expiresAt: string | null = null;
    if (body.expires_in_days && body.expires_in_days > 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + body.expires_in_days);
        expiresAt = expiryDate.toISOString();
    }

    const [newShare] = await db
        .insert(shares)
        .values({
            groupId,
            userId,
            shareToken,
            isPublic: body.is_public ?? true,
            viewCount: 0,
            createdAt: now,
            expiresAt,
        })
        .returning();

    if (!newShare) {
        return notFound('Failed to create share');
    }

    return success({
        share: {
            id: newShare.id,
            share_token: newShare.shareToken,
            share_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${newShare.shareToken}`,
            is_public: newShare.isPublic,
            view_count: newShare.viewCount,
            created_at: newShare.createdAt,
            expires_at: newShare.expiresAt,
        },
    });
}

// GET: Get share info
async function handleGet(request: NextRequest, userId: string) {
    const groupId = getGroupId(request);

    const share = await db.query.shares.findFirst({
        where: and(eq(shares.groupId, groupId), eq(shares.userId, userId)),
    });

    if (!share) {
        return notFound('Share not found');
    }

    return success({
        share: {
            id: share.id,
            share_token: share.shareToken,
            share_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${share.shareToken}`,
            is_public: share.isPublic,
            view_count: share.viewCount,
            created_at: share.createdAt,
            expires_at: share.expiresAt,
        },
    });
}

// DELETE: Remove share
async function handleDelete(request: NextRequest, userId: string) {
    const groupId = getGroupId(request);

    const share = await db.query.shares.findFirst({
        where: and(eq(shares.groupId, groupId), eq(shares.userId, userId)),
    });

    if (!share) {
        return notFound('Share not found');
    }

    await db.delete(shares).where(eq(shares.id, share.id));

    return noContent();
}

export const POST = withErrorHandling(
    withAuth(async (request, ctx) => handlePost(request, ctx.userId))
);

export const GET = withErrorHandling(
    withAuth(async (request, ctx) => handleGet(request, ctx.userId))
);

export const DELETE = withErrorHandling(
    withAuth(async (request, ctx) => handleDelete(request, ctx.userId))
);
