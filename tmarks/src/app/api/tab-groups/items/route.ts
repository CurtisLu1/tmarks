import { badRequest, internalError, notFound, success } from '@/lib/api/response';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { tabGroupItems, tabGroups } from '@/lib/db/schema';
import { generateUUID } from '@/lib/crypto';
import { sanitizeString } from '@/lib/validation';

interface BatchAddItemsRequest {
  group_id: string;
  items: Array<{
    title: string;
    url: string;
    favicon?: string;
  }>;
}

async function handlePost(body: BatchAddItemsRequest, userId: string) {
  if (!body.group_id) return badRequest('group_id is required');
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return badRequest('items array is required and must not be empty');
  }

  const group = await db.query.tabGroups.findFirst({
    where: (eb) => eb.and(eb.eq(tabGroups.id, body.group_id), eb.eq(tabGroups.userId, userId), eb.isNull(tabGroups.deletedAt)),
  });
  if (!group) return notFound('Tab group not found');

  const maxPos = await db
    .select({ max: tabGroupItems.position })
    .from(tabGroupItems)
    .where((eb) => eb.eq(tabGroupItems.groupId, body.group_id))
    .limit(1);

  let position = (maxPos[0]?.max ?? -1) + 1;
  const now = new Date().toISOString();

  for (const item of body.items) {
    await db.insert(tabGroupItems).values({
      id: generateUUID(),
      groupId: body.group_id,
      title: sanitizeString(item.title, 500),
      url: sanitizeString(item.url, 2000),
      favicon: item.favicon ? sanitizeString(item.favicon, 2000) : null,
      position,
      createdAt: now,
    });
    position += 1;
  }

  const items = await db
    .select()
    .from(tabGroupItems)
    .where((eb) => eb.eq(tabGroupItems.groupId, body.group_id))
    .orderBy(tabGroupItems.position);

  return success({
    added_count: body.items.length,
    total_items: items.length,
    items: items.map((item) => ({
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
  });
}

export const POST = withErrorHandling(
  withAuth(async (request, ctx) => {
    const body = (await request.json()) as BatchAddItemsRequest;
    return handlePost(body, ctx.userId);
  }),
);


