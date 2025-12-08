import { NextRequest } from 'next/server';
import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { badRequest, created, success } from '@/lib/api/response';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { tabGroupItems, tabGroups } from '@/lib/db/schema';
import { generateUUID } from '@/lib/crypto';
import { sanitizeString } from '@/lib/validation';
import { incrementStatistics } from '@/lib/statistics';
import type { TabGroup } from '@/lib/types';

interface CreateTabGroupRequest {
  title?: string;
  parent_id?: string | null;
  is_folder?: boolean;
  items?: Array<{
    title: string;
    url: string;
    favicon?: string;
  }>;
}

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
  items: TabGroupWithItems['items'] = [],
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

async function handleGet(request: NextRequest, userId: string) {
  const url = new URL(request.url);
  const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('page_size') || '30', 10), 1), 100);
  const pageCursor = url.searchParams.get('page_cursor') || undefined;

  const baseWhere = and(eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt));

  const rows = await db
    .select()
    .from(tabGroups)
    .where(pageCursor ? and(baseWhere, lt(tabGroups.createdAt, pageCursor)) : baseWhere)
    .orderBy(desc(tabGroups.createdAt))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const groups = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? groups[groups.length - 1]?.createdAt : null;
  const groupIds = groups.map((g) => g.id);

  let items: Array<typeof tabGroupItems.$inferSelect> = [];
  if (groupIds.length > 0) {
    items = await db
      .select()
      .from(tabGroupItems)
      .where(inArray(tabGroupItems.groupId, groupIds))
      .orderBy(tabGroupItems.position);
  }

  const itemsByGroup = new Map<string, TabGroupWithItems['items']>();
  for (const item of items) {
    const list = itemsByGroup.get(item.groupId) || [];
    list.push({
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
    });
    itemsByGroup.set(item.groupId, list);
  }

  const data = groups.map((g) => toApiGroup(g, itemsByGroup.get(g.id) || []));

  return success({
    tab_groups: data,
    meta: {
      page_size: pageSize,
      next_cursor: nextCursor,
    },
  });
}

async function handlePost(request: NextRequest, userId: string) {
  const body = (await request.json()) as CreateTabGroupRequest;

  const isFolder = Boolean(body.is_folder);
  if (!isFolder && (!body.items || body.items.length === 0)) {
    return badRequest('At least one tab item is required for non-folder groups');
  }

  const now = new Date();
  const title =
    body.title && body.title.trim().length > 0
      ? sanitizeString(body.title, 200)
      : isFolder
        ? '新文件夹'
        : now.toISOString();

  const groupId = generateUUID();
  const timestamp = now.toISOString();
  const parentId = body.parent_id || null;

  await db.insert(tabGroups).values({
    id: groupId,
    userId,
    title,
    parentId,
    isFolder,
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (!isFolder && body.items?.length) {
    const itemValues = body.items.map((item, index) => ({
      id: generateUUID(),
      groupId,
      title: sanitizeString(item.title, 500),
      url: sanitizeString(item.url, 2000),
      favicon: item.favicon ? sanitizeString(item.favicon, 2000) : null,
      position: index,
      createdAt: timestamp,
    }));

    for (const value of itemValues) {
      await db.insert(tabGroupItems).values(value);
    }
  }

  const savedGroup = await db.query.tabGroups.findFirst({ where: eq(tabGroups.id, groupId) });
  const savedItems = await db
    .select()
    .from(tabGroupItems)
    .where(eq(tabGroupItems.groupId, groupId))
    .orderBy(tabGroupItems.position);

  // Track statistics
  await incrementStatistics(userId, {
    groupsCreated: 1,
    itemsAdded: savedItems.length,
  });

  return created({
    tab_group: toApiGroup(
      savedGroup!,
      savedItems.map((item) => ({
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
      })),
    ),
  });
}

export const GET = withErrorHandling(withAuth(async (request, ctx) => handleGet(request, ctx.userId)));

export const POST = withErrorHandling(withAuth(async (request, ctx) => handlePost(request, ctx.userId)));


