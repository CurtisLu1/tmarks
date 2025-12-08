import { NextRequest } from 'next/server';
import { and, eq, sql, isNull, isNotNull, desc } from 'drizzle-orm';
import { success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { statistics, tabGroups, tabGroupItems, shares } from '@/lib/db/schema';

async function handleGet(request: NextRequest, userId: string) {
    const daysParam = request.nextUrl.searchParams.get('days');
    const days = parseInt(daysParam || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get statistics from the statistics table for trends
    const stats = await db.query.statistics.findMany({
        where: and(
            eq(statistics.userId, userId),
            sql`${statistics.statDate} >= ${startDateStr}`
        ),
        orderBy: [sql`${statistics.statDate} ASC`],
    });

    // Get current tab group counts (non-deleted)
    const [groupsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabGroups)
        .where(and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)));

    // Get deleted tab group counts
    const [deletedGroupsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabGroups)
        .where(and(eq(tabGroups.userId, userId), isNotNull(tabGroups.deletedAt)));

    // Get total items count
    const [itemsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tabGroupItems)
        .innerJoin(tabGroups, eq(tabGroups.id, tabGroupItems.groupId))
        .where(and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)));

    // Get shares count
    const [sharesCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(shares)
        .where(eq(shares.userId, userId));

    // Get top domains from tab items
    const topDomains = await db
        .select({
            domain: sql<string>`
                CASE 
                    WHEN ${tabGroupItems.url} LIKE 'http://%' OR ${tabGroupItems.url} LIKE 'https://%'
                    THEN split_part(split_part(${tabGroupItems.url}, '://', 2), '/', 1)
                    ELSE split_part(${tabGroupItems.url}, '/', 1)
                END
            `,
            count: sql<number>`count(*)`,
        })
        .from(tabGroupItems)
        .innerJoin(tabGroups, eq(tabGroups.id, tabGroupItems.groupId))
        .where(and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)))
        .groupBy(sql`1`)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

    // Get group size distribution
    const groupSizes = await db
        .select({
            groupId: tabGroupItems.groupId,
            count: sql<number>`count(*)`,
        })
        .from(tabGroupItems)
        .innerJoin(tabGroups, eq(tabGroups.id, tabGroupItems.groupId))
        .where(and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)))
        .groupBy(tabGroupItems.groupId);

    // Calculate size distribution
    const sizeRanges = [
        { range: '1-5', min: 1, max: 5 },
        { range: '6-10', min: 6, max: 10 },
        { range: '11-20', min: 11, max: 20 },
        { range: '21-50', min: 21, max: 50 },
        { range: '50+', min: 51, max: Infinity },
    ];

    const groupSizeDistribution = sizeRanges.map(({ range, min, max }) => ({
        range,
        count: groupSizes.filter((g) => g.count >= min && g.count <= max).length,
    })).filter(d => d.count > 0);

    // Build trends data
    const groupsTrend = stats.map((s) => ({
        date: s.statDate,
        count: s.groupsCreated ?? 0,
    }));

    const itemsTrend = stats.map((s) => ({
        date: s.statDate,
        count: s.itemsAdded ?? 0,
    }));

    return success({
        summary: {
            total_groups: Number(groupsCount?.count ?? 0),
            total_deleted_groups: Number(deletedGroupsCount?.count ?? 0),
            total_items: Number(itemsCount?.count ?? 0),
            total_shares: Number(sharesCount?.count ?? 0),
        },
        trends: {
            groups: groupsTrend,
            items: itemsTrend,
        },
        top_domains: topDomains.map((d) => ({
            domain: d.domain || 'unknown',
            count: Number(d.count),
        })),
        group_size_distribution: groupSizeDistribution,
    });
}

export const GET = withErrorHandling(
    withAuth(async (request, ctx) => handleGet(request, ctx.userId))
);
