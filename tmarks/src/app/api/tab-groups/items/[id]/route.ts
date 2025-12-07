import { NextRequest } from 'next/server';
import { and, eq, gt, sql } from 'drizzle-orm';
import { badRequest, internalError, noContent, notFound, success } from '@/lib/api/response';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { tabGroupItems, tabGroups } from '@/lib/db/schema';
import { sanitizeString } from '@/lib/validation';

interface UpdateTabGroupItemRequest {
  title?: string;
  is_pinned?: boolean;
  is_todo?: boolean;
  is_archived?: boolean;
  position?: number;
}

function getItemId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  return segments[segments.length - 1] || '';
}

async function loadItemWithUser(itemId: string) {
  return db
    .select({
      id: tabGroupItems.id,
      groupId: tabGroupItems.groupId,
      title: tabGroupItems.title,
      url: tabGroupItems.url,
      favicon: tabGroupItems.favicon,
      position: tabGroupItems.position,
      createdAt: tabGroupItems.createdAt,
      isPinned: tabGroupItems.isPinned,
      isTodo: tabGroupItems.isTodo,
      isArchived: tabGroupItems.isArchived,
      userId: tabGroups.userId,
    })
    .from(tabGroupItems)
    .innerJoin(tabGroups, eq(tabGroups.id, tabGroupItems.groupId))
    .where(eq(tabGroupItems.id, itemId))
    .limit(1);
}

async function handlePatch(request: NextRequest, userId: string, itemId: string) {
  const rows = await loadItemWithUser(itemId);
  const item = rows[0];
  if (!item || item.userId !== userId) return notFound('Tab group item not found');

  const body = (await request.json()) as UpdateTabGroupItemRequest;
  const updates: Partial<typeof tabGroupItems.$inferInsert> = {};

  if (body.title !== undefined) updates.title = sanitizeString(body.title, 500);
  if (body.is_pinned !== undefined) updates.isPinned = Boolean(body.is_pinned);
  if (body.is_todo !== undefined) updates.isTodo = Boolean(body.is_todo);
  if (body.is_archived !== undefined) updates.isArchived = Boolean(body.is_archived);
  if (body.position !== undefined) updates.position = body.position;

  if (Object.keys(updates).length === 0) {
    return badRequest('No fields to update');
  }

  await db.update(tabGroupItems).set(updates).where(eq(tabGroupItems.id, itemId));

  const updatedRows = await loadItemWithUser(itemId);
  const updated = updatedRows[0];
  if (!updated) return internalError('Failed to load item after update');

  return success({
    item: {
      id: updated.id,
      group_id: updated.groupId,
      title: updated.title,
      url: updated.url,
      favicon: updated.favicon,
      position: updated.position,
      created_at: updated.createdAt,
      is_pinned: updated.isPinned ? 1 : 0,
      is_todo: updated.isTodo ? 1 : 0,
      is_archived: updated.isArchived ? 1 : 0,
    },
  });
}

async function handleDelete(userId: string, itemId: string) {
  const rows = await loadItemWithUser(itemId);
  const item = rows[0];
  if (!item || item.userId !== userId) return notFound('Tab group item not found');

  await db.delete(tabGroupItems).where(eq(tabGroupItems.id, itemId));
  await db
    .update(tabGroupItems)
    .set({ position: sql`${tabGroupItems.position} - 1` })
    .where(and(eq(tabGroupItems.groupId, item.groupId), gt(tabGroupItems.position, item.position)));

  return noContent();
}

export const PATCH = withErrorHandling(
  withAuth(async (request, ctx) => handlePatch(request, ctx.userId, getItemId(request))),
);

export const DELETE = withErrorHandling(
  withAuth(async (request, ctx) => handleDelete(ctx.userId, getItemId(request))),
);


