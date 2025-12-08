import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { notFound, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { tags } from '@/lib/db/schema';

function getTagId(request: NextRequest): string {
    const segments = request.nextUrl.pathname.split('/');
    // Find 'tags' segment and get the next one as ID
    const tagsIndex = segments.findIndex((s) => s === 'tags');
    return segments[tagsIndex + 1] || '';
}

async function handlePatch(request: NextRequest, userId: string) {
    const tagId = getTagId(request);

    const existing = await db.query.tags.findFirst({
        where: and(eq(tags.id, tagId), eq(tags.userId, userId), isNull(tags.deletedAt)),
    });

    if (!existing) {
        return notFound('Tag not found');
    }

    const now = new Date().toISOString();
    const newClickCount = (existing.clickCount ?? 0) + 1;

    await db
        .update(tags)
        .set({
            clickCount: newClickCount,
            lastClickedAt: now,
            updatedAt: now,
        })
        .where(eq(tags.id, tagId));

    return success({
        tag: {
            ...existing,
            clickCount: newClickCount,
            lastClickedAt: now,
            updatedAt: now,
        },
    });
}

export const PATCH = withErrorHandling(
    withAuth(async (request, ctx) => handlePatch(request, ctx.userId))
);
