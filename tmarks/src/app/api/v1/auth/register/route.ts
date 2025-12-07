import { NextRequest } from 'next/server';
import { ilike } from 'drizzle-orm';
import { badRequest, conflict, created } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { db } from '@/lib/db';
import { auditLogs, userPreferences, users } from '@/lib/db/schema';
import { generateUUID, hashPassword } from '@/lib/crypto';
import { isRegistrationAllowed } from '@/lib/config';
import { isValidEmail, isValidPassword, isValidUsername, sanitizeString } from '@/lib/validation';

interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
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

async function handler(request: NextRequest) {
  if (!isRegistrationAllowed()) {
    return badRequest('Registration is currently disabled');
  }

  const body = (await request.json()) as RegisterRequest;

  if (!body.username || !body.password) {
    return badRequest('Username and password are required');
  }

  if (!isValidUsername(body.username)) {
    return badRequest('Username must be 3-20 characters and contain only letters, numbers, and underscores');
  }

  if (!isValidPassword(body.password)) {
    return badRequest('Password must be at least 8 characters');
  }

  if (body.email && !isValidEmail(body.email)) {
    return badRequest('Invalid email format');
  }

  const username = sanitizeString(body.username, 20);
  const email = body.email ? sanitizeString(body.email, 255) : null;

  const existingUser = await db.query.users.findFirst({
    columns: { id: true },
    where: ilike(users.username, username),
  });

  if (existingUser) {
    return conflict('Username already exists');
  }

  if (email) {
    const existingEmail = await db.query.users.findFirst({
      columns: { id: true },
      where: ilike(users.email, email),
    });

    if (existingEmail) {
      return conflict('Email already exists');
    }
  }

  const passwordHash = await hashPassword(body.password);
  const userId = generateUUID();
  const now = new Date();
  const nowIso = now.toISOString();

  await db.insert(users).values({
    id: userId,
    username,
    email,
    passwordHash,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await db.insert(userPreferences).values({
    userId,
    theme: 'light',
    pageSize: 30,
    viewMode: 'list',
    density: 'normal',
    tagLayout: 'grid',
    sortBy: 'popular',
    updatedAt: nowIso,
  });

  try {
    await db.insert(auditLogs).values({
      userId,
      eventType: 'user.registered',
      payload: JSON.stringify({ username, email }),
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      createdAt: nowIso,
    });
  } catch (auditError) {
    // eslint-disable-next-line no-console
    console.error('Failed to create audit log:', auditError);
  }

  return created({
    user: {
      id: userId,
      username,
      email,
      created_at: nowIso,
    },
  });
}

export const POST = withErrorHandling(handler);


