import { NextRequest } from 'next/server';
import { and, count, eq, ilike, isNull } from 'drizzle-orm';
import { badRequest, conflict, created, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarkTags, tags } from '@/lib/db/schema';
import { generateUUID } from '@/lib/crypto';
import { sanitizeString } from '@/lib/validation';
import type { Tag } from '@/lib/types';

interface CreateTagRequest {
  name: string;
  color?: string | null;
}

type SortBy = 'usage' | 'name' | 'clicks';

function normalizeTag(row: typeof tags.$inferSelect, bookmarkCount = 0): Tag & { bookmark_count: number } {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    color: row.color,
    click_count: Number(row.clickCount ?? 0),
    last_clicked_at: row.lastClickedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    bookmark_count: bookmarkCount,
  };
}

async function handleGet(request: NextRequest, userId: string) {
  const url = new URL(request.url);
  const sort = (url.searchParams.get('sort') as SortBy) || 'usage';

  const rows = await db
    .select({
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      color: tags.color,
      clickCount: tags.clickCount,
      lastClickedAt: tags.lastClickedAt,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      deletedAt: tags.deletedAt,
      bookmarkCount: count(bookmarkTags.bookmarkId),
    })
    .from(tags)
    .leftJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)))
    .groupBy(
      tags.id,
      tags.userId,
      tags.name,
      tags.color,
      tags.clickCount,
      tags.lastClickedAt,
      tags.createdAt,
      tags.updatedAt,
      tags.deletedAt,
    )
    .orderBy(
      ...(sort === 'name'
        ? [tags.name]
        : sort === 'clicks'
          ? [tags.clickCount, tags.name]
          : [count(bookmarkTags.bookmarkId), tags.name]),
    );

  const data = rows.map((row) => normalizeTag(row, Number(row.bookmarkCount ?? 0)));

  return success({ tags: data });
}

async function handlePost(request: NextRequest, userId: string) {
  const body = (await request.json()) as CreateTagRequest;
  if (!body.name) {
    return badRequest('Tag name is required');
  }

  const name = sanitizeString(body.name, 50);
  const color = body.color ? sanitizeString(body.color, 20) : null;

  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), ilike(tags.name, name), isNull(tags.deletedAt)),
  });

  if (existing) {
    return conflict('Tag with this name already exists');
  }

  const now = new Date().toISOString();
  const tagId = generateUUID();

  await db.insert(tags).values({
    id: tagId,
    userId,
    name,
    color,
    createdAt: now,
    updatedAt: now,
  });

  const createdTag = await db.query.tags.findFirst({ where: eq(tags.id, tagId) });

  return created({ tag: createdTag });
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handleGet(request, ctx.userId)),
);

export const POST = withErrorHandling(
  withAuth(async (request, ctx) => handlePost(request, ctx.userId)),
);


