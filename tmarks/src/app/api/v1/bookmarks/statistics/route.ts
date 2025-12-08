import { NextRequest } from 'next/server';
import { and, eq, sql, desc, isNull, count, gte, lte } from 'drizzle-orm';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { success } from '@/lib/api/response';
import { db } from '@/lib/db';
import { bookmarks, bookmarkTags, tags } from '@/lib/db/schema';

interface StatisticsParams {
  granularity: 'day' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
}

async function handleGet(request: NextRequest, userId: string) {
  const url = new URL(request.url);
  const granularity = (url.searchParams.get('granularity') as StatisticsParams['granularity']) || 'day';
  const startDate = url.searchParams.get('start_date') || new Date().toISOString().split('T')[0];
  const endDate = url.searchParams.get('end_date') || new Date().toISOString().split('T')[0];

  // Convert dates to ISO format for comparison
  const startDateTime = `${startDate}T00:00:00.000Z`;
  const endDateTime = `${endDate}T23:59:59.999Z`;

  // Summary counts
  const [totalBookmarks] = await db
    .select({ count: count() })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)));

  const [totalTags] = await db
    .select({ count: count() })
    .from(tags)
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)));

  const [totalClicks] = await db
    .select({ total: sql<number>`COALESCE(SUM(${bookmarks.clickCount}), 0)` })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)));

  const [archivedBookmarks] = await db
    .select({ count: count() })
    .from(bookmarks)
    .where(and(
      eq(bookmarks.userId, userId),
      isNull(bookmarks.deletedAt),
      eq(bookmarks.isArchived, true)
    ));

  const [publicBookmarks] = await db
    .select({ count: count() })
    .from(bookmarks)
    .where(and(
      eq(bookmarks.userId, userId),
      isNull(bookmarks.deletedAt),
      eq(bookmarks.isPublic, true)
    ));

  // Top bookmarks by click count
  const topBookmarksRows = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      url: bookmarks.url,
      clickCount: bookmarks.clickCount,
      lastClickedAt: bookmarks.lastClickedAt,
    })
    .from(bookmarks)
    .where(and(
      eq(bookmarks.userId, userId),
      isNull(bookmarks.deletedAt),
      sql`${bookmarks.clickCount} > 0`
    ))
    .orderBy(desc(bookmarks.clickCount))
    .limit(10);

  const topBookmarks = topBookmarksRows.map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    click_count: b.clickCount ?? 0,
    last_clicked_at: b.lastClickedAt,
  }));

  // Top tags by click count and bookmark count
  const topTagsRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      clickCount: tags.clickCount,
      bookmarkCount: count(bookmarkTags.bookmarkId),
    })
    .from(tags)
    .leftJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)))
    .groupBy(tags.id, tags.name, tags.color, tags.clickCount)
    .orderBy(desc(tags.clickCount), desc(count(bookmarkTags.bookmarkId)))
    .limit(10);

  const topTags = topTagsRows.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    click_count: t.clickCount ?? 0,
    bookmark_count: Number(t.bookmarkCount ?? 0),
  }));

  // Top domains
  const domainRows = await db
    .select({
      url: bookmarks.url,
    })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)));

  // Extract domains and count
  const domainCounts = new Map<string, number>();
  for (const row of domainRows) {
    try {
      const domain = new URL(row.url).hostname;
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    } catch {
      // Invalid URL, skip
    }
  }

  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, domainCount]) => ({ domain, count: domainCount }));

  // Recent clicks - bookmarks with lastClickedAt, ordered by most recent
  const recentClicksRows = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      url: bookmarks.url,
      lastClickedAt: bookmarks.lastClickedAt,
    })
    .from(bookmarks)
    .where(and(
      eq(bookmarks.userId, userId),
      isNull(bookmarks.deletedAt),
      sql`${bookmarks.lastClickedAt} IS NOT NULL`
    ))
    .orderBy(desc(bookmarks.lastClickedAt))
    .limit(10);

  const recentClicks = recentClicksRows.map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    last_clicked_at: b.lastClickedAt || '',
  }));

  // Bookmark clicks - all bookmarks with click data
  const bookmarkClicksRows = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      url: bookmarks.url,
      clickCount: bookmarks.clickCount,
      lastClickedAt: bookmarks.lastClickedAt,
    })
    .from(bookmarks)
    .where(and(
      eq(bookmarks.userId, userId),
      isNull(bookmarks.deletedAt),
      sql`${bookmarks.clickCount} > 0`
    ))
    .orderBy(desc(bookmarks.clickCount))
    .limit(50);

  const bookmarkClicks = bookmarkClicksRows.map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    click_count: b.clickCount ?? 0,
    last_clicked_at: b.lastClickedAt,
  }));

  // Trends data - bookmarks created and clicks in date range
  // For simplicity, we'll generate trends based on created_at dates
  const trendBookmarksRows = await db
    .select({
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .where(and(
      eq(bookmarks.userId, userId),
      isNull(bookmarks.deletedAt),
      gte(bookmarks.createdAt, startDateTime),
      lte(bookmarks.createdAt, endDateTime)
    ));

  // Group by date based on granularity
  const bookmarksByDate = new Map<string, number>();
  for (const row of trendBookmarksRows) {
    const dateKey = getDateKey(row.createdAt, granularity);
    bookmarksByDate.set(dateKey, (bookmarksByDate.get(dateKey) || 0) + 1);
  }

  const bookmarksTrend = Array.from(bookmarksByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, trendCount]) => ({ date, count: trendCount }));

  // For clicks trend, we don't have historical click data per day
  // We'll return an empty array or use lastClickedAt as approximation
  const clicksTrend: Array<{ date: string; count: number }> = [];

  return success({
    summary: {
      total_bookmarks: Number(totalBookmarks?.count ?? 0),
      total_tags: Number(totalTags?.count ?? 0),
      total_clicks: Number(totalClicks?.total ?? 0),
      archived_bookmarks: Number(archivedBookmarks?.count ?? 0),
      public_bookmarks: Number(publicBookmarks?.count ?? 0),
    },
    top_bookmarks: topBookmarks,
    top_tags: topTags,
    top_domains: topDomains,
    bookmark_clicks: bookmarkClicks,
    recent_clicks: recentClicks,
    trends: {
      bookmarks: bookmarksTrend,
      clicks: clicksTrend,
    },
  });
}

function getDateKey(dateStr: string, granularity: string): string {
  const date = new Date(dateStr);

  switch (granularity) {
    case 'day':
      return date.toISOString().split('T')[0] as string;
    case 'week': {
      const year = date.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const days = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const week = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
      return `${year}-W${week.toString().padStart(2, '0')}`;
    }
    case 'month':
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toISOString().split('T')[0] as string;
  }
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handleGet(request, ctx.userId))
);
