import { NextRequest } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { badRequest, internalError, noContent, notFound, success } from '@/lib/api/response';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { tabGroupItems, tabGroups } from '@/lib/db/schema';
import { sanitizeString } from '@/lib/validation';
import type { TabGroup } from '@/lib/types';

interface UpdateTabGroupRequest {
  title?: string;
  color?: string | null;
  tags?: string[] | null;
  parent_id?: string | null;
  position?: number;
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

function getGroupId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  return segments[segments.length - 1] || '';
}

async function loadGroup(userId: string, groupId: string, includeDeleted = false) {
  const where = includeDeleted
    ? and(eq(tabGroups.id, groupId), eq(tabGroups.userId, userId))
    : and(eq(tabGroups.id, groupId), eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt));

  const group = await db.query.tabGroups.findFirst({ where });
  if (!group) return null;

  const items = await db
    .select()
    .from(tabGroupItems)
    .where(eq(tabGroupItems.groupId, groupId))
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

  return toApiGroup(group, mappedItems);
}

async function handleGet(_request: NextRequest, userId: string, groupId: string) {
  const group = await loadGroup(userId, groupId);
  if (!group) return notFound('Tab group not found');
  return success({ tab_group: group });
}

async function handlePatch(_request: NextRequest, userId: string, groupId: string) {
  const existing = await loadGroup(userId, groupId);
  if (!existing) return notFound('Tab group not found');

  const body = (await _request.json()) as UpdateTabGroupRequest;
  const updates: Partial<typeof tabGroups.$inferInsert> = {};

  if (body.title !== undefined) updates.title = sanitizeString(body.title, 200);
  if (body.color !== undefined) updates.color = body.color ? sanitizeString(body.color, 50) : null;
  if (body.tags !== undefined) updates.tags = body.tags ? JSON.stringify(body.tags) : null;
  if (body.parent_id !== undefined) updates.parentId = body.parent_id;
  if (body.position !== undefined) updates.position = body.position;

  if (Object.keys(updates).length === 0) {
    return badRequest('No fields to update');
  }

  updates.updatedAt = new Date().toISOString();

  await db.update(tabGroups).set(updates).where(and(eq(tabGroups.id, groupId), eq(tabGroups.userId, userId)));

  const updated = await loadGroup(userId, groupId);
  if (!updated) return internalError('Failed to load tab group after update');

  return success({ tab_group: updated });
}

async function handleDelete(userId: string, groupId: string) {
  const existing = await loadGroup(userId, groupId);
  if (!existing) return notFound('Tab group not found');

  const now = new Date().toISOString();
  await db
    .update(tabGroups)
    .set({ isDeleted: true, deletedAt: now, updatedAt: now })
    .where(and(eq(tabGroups.id, groupId), eq(tabGroups.userId, userId)));

  return noContent();
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handleGet(request, ctx.userId, getGroupId(request))),
);

export const PATCH = withErrorHandling(
  withAuth(async (request, ctx) => handlePatch(request, ctx.userId, getGroupId(request))),
);

export const DELETE = withErrorHandling(
  withAuth(async (request, ctx) => handleDelete(ctx.userId, getGroupId(request))),
);


