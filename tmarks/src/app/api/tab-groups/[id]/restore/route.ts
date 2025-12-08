import { NextRequest } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { notFound, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { tabGroups } from '@/lib/db/schema';

function getGroupId(request: NextRequest): string {
    const segments = request.nextUrl.pathname.split('/');
    // Find 'tab-groups' segment and get the next one as ID
    const groupsIndex = segments.findIndex((s) => s === 'tab-groups');
    return segments[groupsIndex + 1] || '';
}

async function handlePost(request: NextRequest, userId: string) {
    const groupId = getGroupId(request);

    // Find deleted tab group
    const deletedGroup = await db.query.tabGroups.findFirst({
        where: and(
            eq(tabGroups.id, groupId),
            eq(tabGroups.userId, userId),
            isNotNull(tabGroups.deletedAt)
        ),
    });

    if (!deletedGroup) {
        return notFound('Deleted tab group not found');
    }

    const now = new Date().toISOString();

    // Restore the tab group
    await db
        .update(tabGroups)
        .set({
            isDeleted: false,
            deletedAt: null,
            updatedAt: now,
        })
        .where(eq(tabGroups.id, groupId));

    return success({
        message: 'Tab group restored successfully',
        tab_group: {
            id: groupId,
            restored_at: now,
        },
    });
}

export const POST = withErrorHandling(
    withAuth(async (request, ctx) => handlePost(request, ctx.userId))
);
