import { and, eq, isNull } from 'drizzle-orm';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { success, internalError } from '@/lib/api/response';
import { db } from '@/lib/db';
import { bookmarks, tags, users } from '@/lib/db/schema';

async function handler(userId: string) {
  const user = await db.query.users.findFirst({
    columns: { id: true, username: true, email: true, createdAt: true },
    where: eq(users.id, userId),
  });

  if (!user) {
    return internalError('User not found');
  }

  const statsRows = await db
    .select({
      total: bookmarks.id,
      pinned: bookmarks.isPinned,
      archived: bookmarks.isArchived,
    })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)));

  const totalBookmarks = statsRows.length;
  const pinnedBookmarks = statsRows.filter((r) => r.pinned).length;
  const archivedBookmarks = statsRows.filter((r) => r.archived).length;

  const tagCountRow = await db
    .select({ count: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)))
    .limit(1);

  return success({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.createdAt,
      stats: {
        total_bookmarks: totalBookmarks,
        pinned_bookmarks: pinnedBookmarks,
        archived_bookmarks: archivedBookmarks,
        total_tags: tagCountRow[0]?.count ?? 0,
      },
    },
  });
}

export const GET = withErrorHandling(withAuth(async (_req, ctx) => handler(ctx.userId)));


