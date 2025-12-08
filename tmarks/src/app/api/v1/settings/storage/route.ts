import { NextRequest } from 'next/server';
import { eq, sum } from 'drizzle-orm';
import { success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarkImages, bookmarkSnapshots } from '@/lib/db/schema';

async function handleGet(_request: NextRequest, userId: string) {
  const [snapshotStats] = await db
    .select({
      totalSize: sum(bookmarkSnapshots.fileSize),
    })
    .from(bookmarkSnapshots)
    .where(eq(bookmarkSnapshots.userId, userId));

  const [imageStats] = await db
    .select({
      totalSize: sum(bookmarkImages.fileSize),
    })
    .from(bookmarkImages)
    .where(eq(bookmarkImages.userId, userId));

  const totalUsedBytes = Number(snapshotStats?.totalSize ?? 0) + Number(imageStats?.totalSize ?? 0);

  return success({
    quota: {
      used_bytes: totalUsedBytes,
      limit_bytes: null,
      unlimited: true,
    },
  });
}

export const GET = withErrorHandling(
  withAuth(async (request, ctx) => handleGet(request, ctx.userId)),
);

