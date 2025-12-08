import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { deleteApiKey, getApiKey, revokeApiKey, updateApiKey } from '../store';

function extractId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown';
}

export async function GET(request: NextRequest) {
  const id = extractId(request);
  const record = getApiKey(id);
  if (!record) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'API key not found' } }, { status: 404 });

  return NextResponse.json({
    data: {
      ...record,
      stats: {
        total_requests: 0,
        last_used_at: record.last_used_at,
        last_used_ip: record.last_used_ip,
      },
    },
  });
}

export async function PATCH(request: NextRequest) {
  const id = extractId(request);
  const body = (await request.json().catch(() => ({}))) as Partial<{
    name: string;
    description: string | null;
    permissions: string[];
    expires_at: string | null;
    status: string;
  }>;
  const updated = updateApiKey(id, {
    ...body,
    status: body.status as 'active' | 'revoked' | 'expired' | undefined,
  });
  if (!updated) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'API key not found' } }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const id = extractId(request);
  const hard = url.searchParams.get('hard') === 'true';

  if (hard) {
    deleteApiKey(id);
    return NextResponse.json({ data: { deleted: true } });
  }

  const revoked = revokeApiKey(id);
  if (!revoked) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'API key not found' } }, { status: 404 });
  return NextResponse.json({ data: revoked });
}

