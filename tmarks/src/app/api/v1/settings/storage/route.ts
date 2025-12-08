import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    data: {
      quota: {
        used_bytes: 0,
        limit_bytes: null,
        unlimited: true,
      },
    },
  });
}

