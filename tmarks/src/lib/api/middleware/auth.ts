import { NextRequest, NextResponse } from 'next/server';
import { unauthorized, internalError } from '../response';
import { extractJWT, verifyJWT } from '@/lib/jwt';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export interface AuthContext {
  userId: string;
  sessionId?: string;
  apiKeyId?: string;
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) return null;
  return secret;
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('base64url');
}

async function verifyApiKey(key: string): Promise<{ userId: string; apiKeyId: string }> {
  const hashed = hashApiKey(key);
  const record = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, hashed), eq(apiKeys.status, 'active')),
  });

  if (!record) {
    throw new Error('Invalid API key');
  }

  if (record.expiresAt && new Date(record.expiresAt) <= new Date()) {
    throw new Error('API key expired');
  }

  return { userId: record.userId, apiKeyId: record.id };
}

function extractApiKey(request: NextRequest): string | null {
  const header = request.headers.get('X-API-Key');
  if (!header) return null;
  const trimmed = header.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function withAuth(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const token = extractJWT(request);
    const apiKey = extractApiKey(request);

    if (!token && !apiKey) {
      return unauthorized('Missing authorization token');
    }

    // 优先使用 JWT
    if (token) {
      const secret = getJwtSecret();
      if (!secret) return internalError('JWT_SECRET is not configured', 'CONFIG_MISSING');

      try {
        const payload = await verifyJWT(token, secret);
        return handler(request, { userId: payload.sub, sessionId: payload.session_id });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid token';
        return unauthorized(message);
      }
    }

    // 退回使用 API Key
    if (apiKey) {
      try {
        const result = await verifyApiKey(apiKey);
        return handler(request, { userId: result.userId, apiKeyId: result.apiKeyId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid API key';
        return unauthorized(message, 'API_KEY_INVALID');
      }
    }

    return unauthorized('Missing authorization token');
  };
}

export function optionalAuth(
  handler: (request: NextRequest, context: Partial<AuthContext>) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const secret = getJwtSecret();
    if (!secret) return handler(request, {});

    const token = extractJWT(request);
    if (!token) return handler(request, {});

    try {
      const payload = await verifyJWT(token, secret);
      return handler(request, { userId: payload.sub, sessionId: payload.session_id });
    } catch {
      return handler(request, {});
    }
  };
}


