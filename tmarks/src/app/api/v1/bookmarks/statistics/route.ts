import { NextResponse } from 'next/server';

export async function GET() {
  const empty = {
    summary: {
      total_bookmarks: 0,
      total_tags: 0,
      total_clicks: 0,
      archived_bookmarks: 0,
      public_bookmarks: 0,
    },
    top_bookmarks: [],
    top_tags: [],
    top_domains: [],
    bookmark_clicks: [],
    recent_clicks: [],
    trends: {
      bookmarks: [],
      clicks: [],
    },
  };

  return NextResponse.json({ data: empty });
}

