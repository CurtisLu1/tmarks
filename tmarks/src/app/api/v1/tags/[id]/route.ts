import { NextRequest } from 'next/server';
import { and, eq, ilike, isNull } from 'drizzle-orm';
import {
  badRequest,
  conflict,
  internalError,
  noContent,
  notFound,
  success,
} from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarkTags, tags } from '@/lib/db/schema';
import { sanitizeString } from '@/lib/validation';

interface UpdateTagRequest {
  name?: string;
  color?: string | null;
}

function getTagId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  return segments[segments.length - 1] || '';
}

async function loadTag(tagId: string, userId: string) {
  return db.query.tags.findFirst({
    where: and(eq(tags.id, tagId), eq(tags.userId, userId), isNull(tags.deletedAt)),
  });
}

async function handleGet(request: NextRequest, userId: string, tagId: string) {
  const tag = await loadTag(tagId, userId);
  if (!tag) return notFound('Tag not found');
  return success({ tag });
}

async function handlePatch(request: NextRequest, userId: string, tagId: string) {
  const existing = await loadTag(tagId, userId);
  if (!existing) return notFound('Tag not found');

  const body = (await request.json()) as UpdateTagRequest;

  const updates: Partial<typeof tags.$inferInsert> = {};

  if (body.name !== undefined) {
    const name = sanitizeString(body.name, 50);
    const conflictTag = await db.query.tags.findFirst({
      where: and(eq(tags.userId, userId), ilike(tags.name, name), isNull(tags.deletedAt)),
    });
    if (conflictTag && conflictTag.id !== tagId) {
      return conflict('Tag with this name already exists');
    }
    updates.name = name;
  }

  if (body.color !== undefined) {
    updates.color = body.color ? sanitizeString(body.color, 20) : null;
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('No valid fields to update');
  }

  updates.updatedAt = new Date().toISOString();

  await db.update(tags).set(updates).where(eq(tags.id, tagId));

  const updated = await loadTag(tagId, userId);
  if (!updated) return internalError('Failed to load tag after update');

  return success({ tag: updated });
}

async function handleDelete(userId: string, tagId: string) {
  const existing = await loadTag(tagId, userId);
  if (!existing) return notFound('Tag not found');

  const now = new Date().toISOString();

  await db
    .update(tags)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(tags.id, tagId));

  await db.delete(bookmarkTags).where(eq(bookmarkTags.tagId, tagId));

  return noContent();
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handleGet(request, ctx.userId, getTagId(request))),
);

export const PATCH = withErrorHandling(
  withAuth(async (request, ctx) => handlePatch(request, ctx.userId, getTagId(request))),
);

export const DELETE = withErrorHandling(
  withAuth(async (request, ctx) => handleDelete(ctx.userId, getTagId(request))),
);


