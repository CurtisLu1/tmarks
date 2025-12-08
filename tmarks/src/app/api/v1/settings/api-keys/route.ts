import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys } from './store';

export async function GET() {
  return NextResponse.json({ data: listApiKeys() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    permissions?: string[];
    expires_at?: string | null;
  };
  const record = createApiKey({
    name: body.name,
    description: body.description ?? undefined,
    permissions: body.permissions,
    expires_at: body.expires_at ?? null,
  });
  return NextResponse.json({ data: { ...record, key: record.key } });
}

