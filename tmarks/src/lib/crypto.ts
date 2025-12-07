import { createHash, pbkdf2, randomBytes, randomUUID, timingSafeEqual as nodeTimingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, HASH_LENGTH, 'sha256');
  const combined = Buffer.concat([salt, derived]);
  return `pbkdf2_sha256:${PBKDF2_ITERATIONS}:${combined.toString('base64')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const parts = hash.split(':');
    if (parts.length !== 3 || parts[0] !== 'pbkdf2_sha256') return false;
    const iterations = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(iterations)) return false;

    const stored = Buffer.from(parts[2], 'base64');
    const salt = stored.subarray(0, SALT_LENGTH);
    const originalHash = stored.subarray(SALT_LENGTH);

    const derived = await pbkdf2Async(password, salt, iterations, originalHash.length, 'sha256');
    return safeCompare(originalHash, derived);
  } catch {
    return false;
  }
}

export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

export async function hashRefreshToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('base64url');
}

export function generateUUID(): string {
  return randomUUID();
}

export function generateShortUUID(): string {
  return randomBytes(16).toString('base64url');
}

export function generateNanoId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
  const random = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i += 1) {
    id += alphabet[random[i] % alphabet.length];
  }
  return id;
}

function safeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return nodeTimingSafeEqual(a, b);
}

