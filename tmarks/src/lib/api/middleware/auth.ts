import { NextRequest, NextResponse } from 'next/server';
import { unauthorized, internalError } from '../response';
import { extractJWT, verifyJWT } from '@/lib/jwt';

export interface AuthContext {
  userId: string;
  sessionId?: string;
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) return null;
  return secret;
}

export function withAuth(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const token = extractJWT(request);
    if (!token) return unauthorized('Missing authorization token');

    const secret = getJwtSecret();
    if (!secret) return internalError('JWT_SECRET is not configured', 'CONFIG_MISSING');

    try {
      const payload = await verifyJWT(token, secret);
      return handler(request, { userId: payload.sub, sessionId: payload.session_id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      return unauthorized(message);
    }
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


