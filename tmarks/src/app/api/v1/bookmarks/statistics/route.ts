import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    data: {
      summary: {
        total_bookmarks: 0,
        total_deleted: 0,
        total_public: 0,
      },
      trends: [],
    },
  });
}

