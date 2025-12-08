import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { noContent, notFound } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { tabGroups, tabGroupItems } from '@/lib/db/schema';

function getGroupId(request: NextRequest): string {
    const segments = request.nextUrl.pathname.split('/');
    // Find 'tab-groups' segment and get the next one as ID
    const groupsIndex = segments.findIndex((s) => s === 'tab-groups');
    return segments[groupsIndex + 1] || '';
}

async function handleDelete(request: NextRequest, userId: string) {
    const groupId = getGroupId(request);

    // Find tab group (deleted or not)
    const group = await db.query.tabGroups.findFirst({
        where: and(
            eq(tabGroups.id, groupId),
            eq(tabGroups.userId, userId)
        ),
    });

    if (!group) {
        return notFound('Tab group not found');
    }

    // Delete all items in the group first (cascade should handle this, but explicit for safety)
    await db.delete(tabGroupItems).where(eq(tabGroupItems.groupId, groupId));

    // Permanently delete the tab group
    await db.delete(tabGroups).where(eq(tabGroups.id, groupId));

    return noContent();
}

export const DELETE = withErrorHandling(
    withAuth(async (request, ctx) => handleDelete(request, ctx.userId))
);
