import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { badRequest, internalError } from '@/lib/api/response';
import { db } from '@/lib/db';
import {
  bookmarkTags,
  bookmarks,
  tabGroupItems,
  tabGroups,
  tags,
  users,
} from '@/lib/db/schema';
import type {
  ExportBookmark,
  ExportFormat,
  ExportOptions,
  ExportTabGroup,
  ExportTabGroupItem,
  ExportTag,
  ExportUser,
  TMarksExportData,
} from '@/shared/import-export-types';

const EXPORT_VERSION = '1.0.0';

async function collectUserData(userId: string): Promise<TMarksExportData> {
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!userRow) throw new Error('User not found');

  const user: ExportUser = {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email || undefined,
    created_at: userRow.createdAt,
  };

  const bookmarkRows = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)));

  const tagRows = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)));

  const bookmarkTagRows = await db
    .select({
      bookmarkId: bookmarkTags.bookmarkId,
      tagId: bookmarkTags.tagId,
    })
    .from(bookmarkTags)
    .where(eq(bookmarkTags.userId, userId));

  const tagMap = new Map<string, ExportTag>();
  for (const t of tagRows) {
    tagMap.set(t.id, {
      id: t.id,
      name: t.name,
      color: t.color || undefined,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    });
  }

  const bookmarkTagsMap = new Map<string, string[]>();
  for (const bt of bookmarkTagRows) {
    const list = bookmarkTagsMap.get(bt.bookmarkId) || [];
    list.push(bt.tagId);
    bookmarkTagsMap.set(bt.bookmarkId, list);
  }

  const bookmarksExport: ExportBookmark[] = bookmarkRows.map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    description: b.description || undefined,
    cover_image: b.coverImage || undefined,
    favicon: b.favicon || undefined,
    is_pinned: Boolean(b.isPinned),
    is_archived: Boolean(b.isArchived),
    is_public: Boolean(b.isPublic),
    click_count: Number(b.clickCount ?? 0),
    last_clicked_at: b.lastClickedAt || undefined,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    tags: bookmarkTagsMap.get(b.id) || [],
  }));

  const tabGroupRows = await db
    .select()
    .from(tabGroups)
    .where(and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)));

  const tabGroupItemRows = await db
    .select()
    .from(tabGroupItems)
    .where((eb) => eb.inArray(tabGroupItems.groupId, tabGroupRows.map((g) => g.id)));

  const tabGroupsMap = new Map<string, ExportTabGroup>();
  for (const g of tabGroupRows) {
    tabGroupsMap.set(g.id, {
      id: g.id,
      user_id: g.userId,
      title: g.title,
      color: g.color || undefined,
      parent_id: g.parentId || undefined,
      is_folder: Boolean(g.isFolder),
      position: g.position ?? 0,
      tags: g.tags ? JSON.parse(g.tags) : undefined,
      created_at: g.createdAt,
      updated_at: g.updatedAt,
      items: [],
    });
  }

  for (const item of tabGroupItemRows) {
    const entry: ExportTabGroupItem = {
      id: item.id,
      group_id: item.groupId,
      title: item.title,
      url: item.url,
      favicon: item.favicon || undefined,
      position: item.position,
      created_at: item.createdAt,
    };
    const list = tabGroupsMap.get(item.groupId)?.items;
    if (list) list.push(entry);
  }

  return {
    version: EXPORT_VERSION,
    user,
    bookmarks: bookmarksExport,
    tags: Array.from(tagMap.values()),
    tab_groups: Array.from(tabGroupsMap.values()),
  };
}

function buildFilename(username: string, format: ExportFormat = 'json') {
  const safe = username.replace(/[^a-zA-Z0-9_-]/g, '_') || 'tmarks';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safe}-export-${stamp}.${format}`;
}

async function handler(request: NextRequest, userId: string) {
  const searchParams = request.nextUrl.searchParams;
  const format = (searchParams.get('format') || 'json') as ExportFormat;

  if (format !== 'json') {
    return badRequest('Only json export is supported in this build');
  }

  const exportData = await collectUserData(userId);
  const body = JSON.stringify(exportData, null, searchParams.get('pretty_print') === 'false' ? undefined : 2);
  const filename = buildFilename(exportData.user.username || exportData.user.id, format);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handler(request, ctx.userId)),
);


