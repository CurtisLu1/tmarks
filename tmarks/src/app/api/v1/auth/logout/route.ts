import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { badRequest, noContent } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { auditLogs, authTokens } from '@/lib/db/schema';
import { hashRefreshToken } from '@/lib/crypto';

interface LogoutRequest {
  refresh_token: string;
  revoke_all?: boolean;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  return 'unknown';
}

async function handler(request: NextRequest) {
  const authedHandler = withAuth(async (req, ctx) => {
    const body = (await req.json()) as LogoutRequest;

    if (!body.refresh_token) {
      return badRequest('Refresh token is required');
    }

    const nowIso = new Date().toISOString();

    if (body.revoke_all) {
      await db
        .update(authTokens)
        .set({ revokedAt: nowIso })
        .where(and(eq(authTokens.userId, ctx.userId), isNull(authTokens.revokedAt)));

      await db.insert(auditLogs).values({
        userId: ctx.userId,
        eventType: 'auth.logout_all_devices',
        payload: JSON.stringify({ revoked_count: 'all' }),
        ip: getClientIp(req),
        createdAt: nowIso,
      });
    } else {
      const tokenHash = await hashRefreshToken(body.refresh_token);

      await db
        .update(authTokens)
        .set({ revokedAt: nowIso })
        .where(
          and(
            eq(authTokens.userId, ctx.userId),
            eq(authTokens.refreshTokenHash, tokenHash),
            isNull(authTokens.revokedAt),
          ),
        );

      await db.insert(auditLogs).values({
        userId: ctx.userId,
        eventType: 'auth.logout',
        payload: JSON.stringify({ single_device: true }),
        ip: getClientIp(req),
        createdAt: nowIso,
      });
    }

    return noContent();
  });

  return authedHandler(request);
}

export const POST = withErrorHandling(handler);


