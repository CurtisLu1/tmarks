import { NextRequest } from 'next/server';
import { ilike, or } from 'drizzle-orm';
import { badRequest, internalError, success, unauthorized } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { authTokens, auditLogs, users } from '@/lib/db/schema';
import { generateToken, generateUUID, hashRefreshToken, verifyPassword } from '@/lib/crypto';
import { getJwtAccessTokenExpiresIn, getJwtRefreshTokenExpiresIn } from '@/lib/config';
import { generateJWT, parseExpiry } from '@/lib/jwt';

interface LoginRequest {
  username: string;
  password: string;
  remember_me?: boolean;
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

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

async function findUser(identifier: string) {
  return db.query.users.findFirst({
    columns: {
      id: true,
      username: true,
      email: true,
      passwordHash: true,
      role: true,
    },
    where: or(ilike(users.username, identifier), ilike(users.email, identifier)),
  });
}

async function logAudit(
  request: NextRequest,
  payload: Record<string, unknown>,
  userId?: string,
  eventType: string = 'auth.login_failed',
) {
  const now = new Date().toISOString();
  await db.insert(auditLogs).values({
    userId,
    eventType,
    payload: JSON.stringify(payload),
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    createdAt: now,
  });
}

async function handler(request: NextRequest) {
  const body = (await request.json()) as LoginRequest;

  if (!body.username || !body.password) {
    return badRequest('Username and password are required');
  }

  const user = await findUser(body.username);

  if (!user) {
    await logAudit(request, { username: body.username, reason: 'user_not_found' });
    return unauthorized('Invalid username or password');
  }

  const isValid = await verifyPassword(body.password, user.passwordHash);
  if (!isValid) {
    await logAudit(
      request,
      { username: body.username, reason: 'invalid_password' },
      user.id,
    );
    return unauthorized('Invalid username or password');
  }

  const secret = getJwtSecret();
  if (!secret) {
    return internalError('JWT_SECRET is not configured', 'CONFIG_MISSING');
  }

  const sessionId = generateUUID();

  const accessTokenExpiresInStr = getJwtAccessTokenExpiresIn();
  const accessTokenExpiresIn = parseExpiry(accessTokenExpiresInStr);
  const accessToken = await generateJWT(
    { sub: user.id, session_id: sessionId },
    secret,
    accessTokenExpiresInStr,
  );

  const refreshToken = generateToken(32);
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  const refreshTokenExpiresInStr = getJwtRefreshTokenExpiresIn();
  const refreshTokenExpiresIn = parseExpiry(refreshTokenExpiresInStr);
  const now = new Date();
  const refreshExpiresAt = new Date(now.getTime() + refreshTokenExpiresIn * 1000).toISOString();
  const nowIso = now.toISOString();

  await db.insert(authTokens).values({
    userId: user.id,
    refreshTokenHash,
    expiresAt: refreshExpiresAt,
    createdAt: nowIso,
  });

  await logAudit(
    request,
    { session_id: sessionId, remember_me: Boolean(body.remember_me) },
    user.id,
    'auth.login_success',
  );

  return success({
    access_token: accessToken,
    refresh_token: refreshToken,
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


