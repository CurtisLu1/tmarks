import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { badRequest, internalError, success, unauthorized } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { auditLogs, authTokens, users } from '@/lib/db/schema';
import { generateUUID, hashRefreshToken } from '@/lib/crypto';
import { getJwtAccessTokenExpiresIn } from '@/lib/config';
import { generateJWT, parseExpiry } from '@/lib/jwt';

interface RefreshRequest {
  refresh_token: string;
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  return secret && secret.trim().length > 0 ? secret : null;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  return 'unknown';
}

async function handler(request: NextRequest) {
  const body = (await request.json()) as RefreshRequest;

  if (!body.refresh_token) {
    return badRequest('Refresh token is required');
  }

  const tokenHash = await hashRefreshToken(body.refresh_token);

  const tokenRecord = await db.query.authTokens.findFirst({
    columns: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
    where: eq(authTokens.refreshTokenHash, tokenHash),
  });

  if (!tokenRecord) {
    return unauthorized('Invalid refresh token');
  }

  if (tokenRecord.revokedAt) {
    return unauthorized('Refresh token has been revoked');
  }

  const expiresAt = new Date(tokenRecord.expiresAt);
  if (expiresAt < new Date()) {
    return unauthorized('Refresh token has expired');
  }

  const secret = getJwtSecret();
  if (!secret) {
    return internalError('JWT_SECRET is not configured', 'CONFIG_MISSING');
  }

  const sessionId = generateUUID();
  const accessTokenExpiresInStr = getJwtAccessTokenExpiresIn();
  const accessTokenExpiresIn = parseExpiry(accessTokenExpiresInStr);
  const accessToken = await generateJWT(
    { sub: tokenRecord.userId, session_id: sessionId },
    secret,
    accessTokenExpiresInStr,
  );

  const user = await db.query.users.findFirst({
    columns: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
    where: eq(users.id, tokenRecord.userId),
  });

  if (!user) {
    return unauthorized('User not found');
  }

  const nowIso = new Date().toISOString();

  await db.insert(auditLogs).values({
    userId: tokenRecord.userId,
    eventType: 'auth.token_refreshed',
    payload: JSON.stringify({ session_id: sessionId }),
    ip: getClientIp(request),
    createdAt: nowIso,
  });

  return success({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: accessTokenExpiresIn,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}

export const POST = withErrorHandling(handler);


