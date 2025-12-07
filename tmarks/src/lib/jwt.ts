import { CompactSign, jwtVerify } from 'jose';
import { Buffer } from 'buffer';

export interface JWTPayload {
  sub: string;
  exp: number;
  iat: number;
  session_id?: string;
}

export function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid expiry format');
  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  if (Number.isNaN(value)) throw new Error('Invalid expiry format');
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      throw new Error('Invalid expiry unit');
  }
}

function getSecretKey(secret: string): Uint8Array {
  return Buffer.from(secret, 'utf-8');
}

export async function generateJWT(
  payload: Omit<JWTPayload, 'exp' | 'iat'>,
  secret: string,
  expiresIn: string = '30d',
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const exp = issuedAt + parseExpiry(expiresIn);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: issuedAt,
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload), 'utf-8');
  return new CompactSign(encodedPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(getSecretKey(secret));
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(secret));
  const { sub, exp, iat, session_id } = payload;
  if (!sub || !exp || !iat) {
    throw new Error('Invalid token payload');
  }
  return {
    sub: String(sub),
    exp: Number(exp),
    iat: Number(iat),
    session_id: session_id ? String(session_id) : undefined,
  };
}

export function extractJWT(request: { headers: { get(name: string): string | null } }): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

