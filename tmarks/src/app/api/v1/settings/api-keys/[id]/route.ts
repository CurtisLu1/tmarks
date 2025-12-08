import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function extractId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown';
}

export async function GET(request: NextRequest) {
  const id = extractId(request);
  const now = new Date().toISOString();
  return NextResponse.json({
    data: {
      id,
      key_prefix: 'mock',
      name: 'mock-key',
      description: null,
      permissions: [],
      status: 'active',
      expires_at: null,
      last_used_at: null,
      last_used_ip: null,
      created_at: now,
      updated_at: now,
      stats: {
        total_requests: 0,
        last_used_at: null,
        last_used_ip: null,
      },
    },
  });
}

export async function PATCH(request: NextRequest) {
  return GET(request);
}

export async function DELETE() {
  return NextResponse.json({ data: { deleted: true } });
}

