import { NextRequest } from 'next/server';
import { and, eq, sql, isNull } from 'drizzle-orm';
import { success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { statistics, tabGroups, tabGroupItems, bookmarks, tags } from '@/lib/db/schema';

async function handleGet(request: NextRequest, userId: string) {
    const daysParam = request.nextUrl.searchParams.get('days');
    const days = parseInt(daysParam || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get statistics from the statistics table
    const stats = await db.query.statistics.findMany({
        where: and(
            eq(statistics.userId, userId),
            sql`${statistics.statDate} >= ${startDateStr}`
        ),
        orderBy: [sql`${statistics.statDate} ASC`],
    });

    // Get current tab group counts
    const [groupsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabGroups)
        .where(and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)));

    const [itemsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabGroupItems)
        .innerJoin(tabGroups, eq(tabGroups.id, tabGroupItems.groupId))
        .where(and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)));

    // Get current bookmark counts
    const [bookmarksCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)));

    // Get total click count
    const [clicksCount] = await db
        .select({ total: sql<number>`COALESCE(SUM(${bookmarks.clickCount}), 0)` })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)));

    // Get current tag counts
    const [tagsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tags)
        .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)));

    // Aggregate daily stats
    const dailyStats = stats.map((s) => ({
        date: s.statDate,
        groups_created: s.groupsCreated ?? 0,
        groups_deleted: s.groupsDeleted ?? 0,
        items_added: s.itemsAdded ?? 0,
        items_deleted: s.itemsDeleted ?? 0,
        shares_created: s.sharesCreated ?? 0,
    }));

    // Calculate totals
    const totals = {
        total_bookmarks: Number(bookmarksCount?.count ?? 0),
        total_clicks: Number(clicksCount?.total ?? 0),
        total_tags: Number(tagsCount?.count ?? 0),
        total_groups: Number(groupsCount?.count ?? 0),
        total_items: Number(itemsCount?.count ?? 0),
        groups_created: stats.reduce((sum, s) => sum + (s.groupsCreated ?? 0), 0),
        groups_deleted: stats.reduce((sum, s) => sum + (s.groupsDeleted ?? 0), 0),
        items_added: stats.reduce((sum, s) => sum + (s.itemsAdded ?? 0), 0),
        items_deleted: stats.reduce((sum, s) => sum + (s.itemsDeleted ?? 0), 0),
        shares_created: stats.reduce((sum, s) => sum + (s.sharesCreated ?? 0), 0),
    };

    return success({
        period: {
            days,
            start_date: startDateStr,
            end_date: new Date().toISOString().split('T')[0],
        },
        totals,
        daily: dailyStats,
    });
}

export const GET = withErrorHandling(
    withAuth(async (request, ctx) => handleGet(request, ctx.userId))
);

