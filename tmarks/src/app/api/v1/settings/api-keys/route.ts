import { createHash, randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { withAuth } from '@/lib/api/middleware/auth';
import { success } from '@/lib/api/response';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('base64url');
}

export const GET = withAuth(async (_request, ctx) => {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, ctx.userId));

  const keys = rows.map((row) => ({
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
  }));

  return success({ keys, quota: { used: keys.length, limit: 3 } });
});

export const POST = withAuth(async (request: NextRequest, ctx) => {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    permissions?: string[];
    expires_at?: string | null;
  };

  const plainKey = `sk-${randomUUID().replace(/-/g, '')}`;
  const keyPrefix = plainKey.slice(0, 6);
  const now = new Date().toISOString();

  const inserted = await db
    .insert(apiKeys)
    .values({
      id: randomUUID(),
      userId: ctx.userId,
      keyHash: hashKey(plainKey),
      keyPrefix,
      name: body.name || 'API Key',
      description: body.description ?? null,
      permissions: JSON.stringify(body.permissions ?? []),
      status: 'active',
      expiresAt: body.expires_at ?? null,
      lastUsedAt: null,
      lastUsedIp: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    return success({ error: 'Failed to create key' });
  }
  return success({
    id: row.id,
    key: plainKey, // 仅创建时返回
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

