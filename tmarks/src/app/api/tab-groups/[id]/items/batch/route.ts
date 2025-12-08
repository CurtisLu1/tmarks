import { NextRequest } from 'next/server';
import { and, eq, isNull, max } from 'drizzle-orm';
import { badRequest, notFound, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { tabGroups, tabGroupItems } from '@/lib/db/schema';
import { sanitizeString, isValidUrl } from '@/lib/validation';

interface BatchAddItem {
    title: string;
    url: string;
    favicon?: string;
}

interface BatchAddRequest {
    items: BatchAddItem[];
}

function getGroupId(request: NextRequest): string {
    const segments = request.nextUrl.pathname.split('/');
    const groupsIndex = segments.findIndex((s) => s === 'tab-groups');
    return segments[groupsIndex + 1] || '';
}

async function handlePost(request: NextRequest, userId: string) {
    const groupId = getGroupId(request);

    // Verify group exists and belongs to user
    const group = await db.query.tabGroups.findFirst({
        where: and(eq(tabGroups.id, groupId), eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)),
    });

    if (!group) {
        return notFound('Tab group not found');
    }

    const body = (await request.json()) as BatchAddRequest;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return badRequest('Invalid request: items array is required');
    }

    if (body.items.length > 100) {
        return badRequest('Maximum 100 items per batch request');
    }

    // Get current max position
    const [maxPositionResult] = await db
        .select({ maxPos: max(tabGroupItems.position) })
        .from(tabGroupItems)
        .where(eq(tabGroupItems.groupId, groupId));

    let currentPosition = (maxPositionResult?.maxPos ?? -1) + 1;
    const now = new Date().toISOString();
    const addedItems: Array<{
        id: string;
        title: string;
        url: string;
        favicon?: string;
        position: number;
        created_at: string;
    }> = [];

    for (const item of body.items) {
        if (!item.url || !isValidUrl(item.url)) {
            continue; // Skip invalid items
        }

        const [newItem] = await db
            .insert(tabGroupItems)
            .values({
                groupId,
                title: sanitizeString(item.title || item.url, 500),
                url: sanitizeString(item.url, 2000),
                favicon: item.favicon ? sanitizeString(item.favicon, 2000) : null,
                position: currentPosition,
                createdAt: now,
            })
            .returning();

        if (!newItem) {
            continue;
        }

        addedItems.push({
            id: newItem.id,
            title: newItem.title,
            url: newItem.url,
            favicon: newItem.favicon ?? undefined,
            position: newItem.position,
            created_at: newItem.createdAt,
        });

        currentPosition++;
    }

    // Update group's updated_at
    await db
        .update(tabGroups)
        .set({ updatedAt: now })
        .where(eq(tabGroups.id, groupId));

    // Get total items count
    const allItems = await db.query.tabGroupItems.findMany({
        where: eq(tabGroupItems.groupId, groupId),
    });

    return success({
        message: 'Items added successfully',
        added_count: addedItems.length,
        total_items: allItems.length,
        items: addedItems,
    });
}

export const POST = withErrorHandling(
    withAuth(async (request, ctx) => handlePost(request, ctx.userId))
);
