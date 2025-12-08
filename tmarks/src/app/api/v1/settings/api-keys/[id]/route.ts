import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { withAuth } from '@/lib/api/middleware/auth';
import { success, notFound } from '@/lib/api/response';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';

function extractId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown';
}

export const GET = withAuth(async (request, ctx) => {
  const id = extractId(request);
  const record = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.id, id), eq(apiKeys.userId, ctx.userId)),
  });

  if (!record) return notFound('API key not found');

  return success({
    id: record.id,
    key_prefix: record.keyPrefix,
    name: record.name,
    description: record.description,
    permissions: JSON.parse(record.permissions) as string[],
    status: record.status,
    expires_at: record.expiresAt,
    last_used_at: record.lastUsedAt,
    last_used_ip: record.lastUsedIp,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    stats: {
      total_requests: 0,
      last_used_at: record.lastUsedAt,
      last_used_ip: record.lastUsedIp,
    },
  });
});

export const PATCH = withAuth(async (request, ctx) => {
  const id = extractId(request);
  const body = (await request.json().catch(() => ({}))) as Partial<{
    name: string;
    description: string | null;
    permissions: string[];
    expires_at: string | null;
    status: string;
  }>;

  const updates: Partial<typeof apiKeys.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description ?? null;
  if (body.permissions !== undefined) updates.permissions = JSON.stringify(body.permissions ?? []);
  if (body.expires_at !== undefined) updates.expiresAt = body.expires_at ?? null;
  if (body.status !== undefined) updates.status = body.status;

  const updated = await db
    .update(apiKeys)
    .set(updates)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, ctx.userId)))
    .returning();

  const row = updated[0];
  if (!row) return notFound('API key not found');

  return success({
    id: row.id,
    key_prefix: row.keyPrefix,
    name: row.name,
    description: row.description,
    permissions: JSON.parse(row.permissions) as string[],
    status: row.status,
    expires_at: row.expiresAt,
    last_used_at: row.lastUsedAt,
    last_used_ip: row.lastUsedIp,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
});

export const DELETE = withAuth(async (request, ctx) => {
  const url = new URL(request.url);
  const id = extractId(request);
  const hard = url.searchParams.get('hard') === 'true';

  if (hard) {
    await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, ctx.userId)));
    return success({ deleted: true });
  }

  const revoked = await db
    .update(apiKeys)
    .set({ status: 'revoked', updatedAt: new Date().toISOString() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, ctx.userId)))
    .returning();

  const row = revoked[0];
  if (!row) return notFound('API key not found');

  return success({
    id: row.id,
    key_prefix: row.keyPrefix,
    name: row.name,
    description: row.description,
    permissions: JSON.parse(row.permissions) as string[],
    status: row.status,
    expires_at: row.expiresAt,
    last_used_at: row.lastUsedAt,
    last_used_ip: row.lastUsedIp,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
});

