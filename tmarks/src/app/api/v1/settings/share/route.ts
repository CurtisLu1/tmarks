import { NextRequest, NextResponse } from 'next/server';

const defaultShare = {
  enabled: false,
  slug: null,
  title: null,
  description: null,
};

export async function GET() {
  return NextResponse.json({ data: { share: defaultShare } });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    data: {
      share: {
        ...defaultShare,
        ...body,
      },
    },
  });
}

