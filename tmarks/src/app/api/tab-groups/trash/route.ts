import { NextRequest } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { tabGroups, tabGroupItems } from '@/lib/db/schema';
import type { TabGroup } from '@/lib/types';

interface TabGroupWithItems extends TabGroup {
    items: Array<{
        id: string;
        group_id: string;
        title: string;
        url: string;
        favicon: string | null;
        position: number;
        created_at: string;
        is_pinned?: number;
        is_todo?: number;
        is_archived?: number;
    }>;
    item_count: number;
}

function toApiGroup(
    row: typeof tabGroups.$inferSelect,
    items: TabGroupWithItems['items'] = []
): TabGroupWithItems {
    return {
        id: row.id,
        user_id: row.userId,
        title: row.title,
        color: row.color,
        tags: row.tags ? JSON.parse(row.tags) : null,
        parent_id: row.parentId,
        is_folder: Number(row.isFolder),
        is_deleted: Number(row.isDeleted ?? 0),
        deleted_at: row.deletedAt ?? null,
        position: row.position ?? 0,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        items,
        item_count: items.length,
    };
}

async function handleGet(_request: NextRequest, userId: string) {
    // Get all deleted tab groups for this user
    const deletedGroups = await db.query.tabGroups.findMany({
        where: and(
            eq(tabGroups.userId, userId),
            isNotNull(tabGroups.deletedAt)
        ),
        orderBy: [desc(tabGroups.deletedAt)],
    });

    const groupsWithItems: TabGroupWithItems[] = [];

    for (const group of deletedGroups) {
        const items = await db
            .select()
            .from(tabGroupItems)
            .where(eq(tabGroupItems.groupId, group.id))
            .orderBy(tabGroupItems.position, desc(tabGroupItems.createdAt));

        const mappedItems = items.map((item) => ({
            id: item.id,
            group_id: item.groupId,
            title: item.title,
            url: item.url,
            favicon: item.favicon,
            position: item.position,
            created_at: item.createdAt,
            is_pinned: item.isPinned ? 1 : 0,
            is_todo: item.isTodo ? 1 : 0,
            is_archived: item.isArchived ? 1 : 0,
        }));

        groupsWithItems.push(toApiGroup(group, mappedItems));
    }

    return success({
        tab_groups: groupsWithItems,
        meta: {
            count: groupsWithItems.length,
        },
    });
}

export const GET = withErrorHandling(
    withAuth(async (request, ctx) => handleGet(request, ctx.userId))
);
