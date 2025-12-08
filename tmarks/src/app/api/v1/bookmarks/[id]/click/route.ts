import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { success, internalError, notFound } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { bookmarkClickEvents, bookmarks } from '@/lib/db/schema';

function getBookmarkId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/');
  return segments[segments.length - 2] ?? segments[segments.length - 1] ?? '';
}

export const POST = withErrorHandling(
  withAuth(async (request, ctx) => {
    try {
      const bookmarkId = getBookmarkId(request);
      const now = new Date().toISOString();

      const existing = await db.query.bookmarks.findFirst({
        where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, ctx.userId), isNull(bookmarks.deletedAt)),
      });

      if (!existing) {
        return notFound('Bookmark not found');
      }

      await db
        .update(bookmarks)
        .set({
          clickCount: Number(existing.clickCount ?? 0) + 1,
          lastClickedAt: now,
        })
        .where(eq(bookmarks.id, bookmarkId));

      await db.insert(bookmarkClickEvents).values({
        bookmarkId,
        userId: ctx.userId,
        clickedAt: now,
      });

      return success({ message: 'Click recorded successfully', clicked_at: now });
    } catch (error) {
      console.error('Record click error:', error);
      return internalError('Failed to record click');
    }
  }),
);


