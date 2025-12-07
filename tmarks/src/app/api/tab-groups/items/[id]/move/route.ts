import { NextRequest } from 'next/server';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { badRequest, internalError, notFound, success } from '@/lib/api/response';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { tabGroupItems, tabGroups } from '@/lib/db/schema';

interface MoveItemRequest {
  target_group_id: string;
  position?: number;
}

function getItemId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  return segments[segments.length - 2] || segments[segments.length - 1];
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

async function handlePost(request: NextRequest, userId: string, itemId: string) {
  const body = (await request.json()) as MoveItemRequest;
  if (!body.target_group_id) return badRequest('target_group_id is required');

  const rows = await loadItemWithUser(itemId);
  const item = rows[0];
  if (!item || item.userId !== userId) return notFound('Tab group item not found');

  const targetGroup = await db.query.tabGroups.findFirst({
    where: and(eq(tabGroups.id, body.target_group_id), eq(tabGroups.userId, userId), isNull(tabGroups.deletedAt)),
  });
  if (!targetGroup) return badRequest('Target group not found or access denied');

  if (item.groupId === body.target_group_id) {
    if (body.position !== undefined) {
      await db
        .update(tabGroupItems)
        .set({ position: body.position })
        .where(eq(tabGroupItems.id, itemId));

      await db
        .update(tabGroupItems)
        .set({ position: sql`${tabGroupItems.position} + 1` })
        .where(
          and(
            eq(tabGroupItems.groupId, item.groupId),
            gt(tabGroupItems.position, body.position - 1),
            sql`${tabGroupItems.id} != ${itemId}`,
          ),
        );
    }
  } else {
    const maxPos = await db
      .select({ max: tabGroupItems.position })
      .from(tabGroupItems)
      .where(eq(tabGroupItems.groupId, body.target_group_id))
      .limit(1);

    const targetPosition =
      body.position !== undefined ? body.position : (maxPos[0]?.max ?? -1) + 1;

    await db
      .update(tabGroupItems)
      .set({ groupId: body.target_group_id, position: targetPosition })
      .where(eq(tabGroupItems.id, itemId));

    await db
      .update(tabGroupItems)
      .set({ position: sql`${tabGroupItems.position} - 1` })
      .where(and(eq(tabGroupItems.groupId, item.groupId), gt(tabGroupItems.position, item.position)));

    if (body.position !== undefined) {
      await db
        .update(tabGroupItems)
        .set({ position: sql`${tabGroupItems.position} + 1` })
        .where(
          and(
            eq(tabGroupItems.groupId, body.target_group_id),
            gt(tabGroupItems.position, targetPosition - 1),
            sql`${tabGroupItems.id} != ${itemId}`,
          ),
        );
    }
  }

  const updatedRows = await loadItemWithUser(itemId);
  const updated = updatedRows[0];
  if (!updated) return internalError('Failed to load item after move');

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
    message: 'Item moved successfully',
  });
}

export const POST = withErrorHandling(
  withAuth(async (request, ctx) => handlePost(request, ctx.userId, getItemId(request))),
);


