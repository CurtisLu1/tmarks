import { NextRequest, NextResponse } from 'next/server';

const MOCK_QUOTA = { used: 0, limit: 3 };

export async function GET() {
  return NextResponse.json({ data: { keys: [], quota: MOCK_QUOTA } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  return NextResponse.json({
    data: {
      id: crypto.randomUUID(),
      key: crypto.randomUUID(),
      key_prefix: 'mock',
      name: body?.name ?? 'mock-key',
      description: body?.description ?? null,
      permissions: body?.permissions ?? [],
      status: 'active',
      expires_at: body?.expires_at ?? null,
      last_used_at: null,
      last_used_ip: null,
      created_at: now,
      updated_at: now,
    },
  });
}

