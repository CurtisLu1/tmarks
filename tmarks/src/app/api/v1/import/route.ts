import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { badRequest, created } from '@/lib/api/response';
import { db } from '@/lib/db';
import {
  bookmarkTags,
  bookmarks,
  tabGroupItems,
  tabGroups,
  tags,
} from '@/lib/db/schema';
import type {
  TMarksExportData,
  ExportBookmark,
  ExportTag,
  ExportTabGroup,
} from '@shared/import-export-types';

interface ImportResult {
  bookmarks: number;
  tags: number;
  tab_groups: number;
  tab_group_items: number;
}

function sanitizeId(id: string | undefined): string | undefined {
  return id?.trim() || undefined;
}

async function upsertTags(userId: string, incoming: ExportTag[]): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  for (const tag of incoming) {
    const tagId = sanitizeId(tag.id) || crypto.randomUUID();
    await db
      .insert(tags)
      .values({
        id: tagId,
        userId,
        name: tag.name,
        color: tag.color ?? null,
        createdAt: tag.created_at ?? new Date().toISOString(),
        updatedAt: tag.updated_at ?? new Date().toISOString(),
      })
      .onConflictDoNothing({ target: tags.id });
    idMap.set(tag.id ?? tag.name, tagId);
  }
  return idMap;
}

async function upsertBookmarks(userId: string, incoming: ExportBookmark[], tagMap: Map<string, string>) {
  for (const b of incoming) {
    const bookmarkId = sanitizeId(b.id) || crypto.randomUUID();
    await db
      .insert(bookmarks)
      .values({
        id: bookmarkId,
        userId,
        title: b.title,
        url: b.url,
        description: b.description ?? null,
        coverImage: b.cover_image ?? null,
        favicon: b.favicon ?? null,
        isPinned: Boolean(b.is_pinned),
        isArchived: Boolean(b.is_archived),
        isPublic: Boolean(b.is_public),
        clickCount: b.click_count ?? 0,
        lastClickedAt: b.last_clicked_at ?? null,
        hasSnapshot: Boolean(b.snapshot_count && b.snapshot_count > 0),
        snapshotCount: b.snapshot_count ?? 0,
        createdAt: b.created_at ?? new Date().toISOString(),
        updatedAt: b.updated_at ?? new Date().toISOString(),
      })
      .onConflictDoNothing({ target: bookmarks.id });

    if (b.tags?.length) {
      for (const sourceTagId of b.tags) {
        const tagId = tagMap.get(sourceTagId);
        if (!tagId) continue;
        await db
          .insert(bookmarkTags)
          .values({ bookmarkId, tagId, userId, createdAt: new Date().toISOString() })
          .onConflictDoNothing({ target: [bookmarkTags.bookmarkId, bookmarkTags.tagId] });
      }
    }
  }
}

async function upsertTabGroups(userId: string, incoming: ExportTabGroup[]) {
  for (const g of incoming) {
    const groupId = sanitizeId(g.id) || crypto.randomUUID();
    await db
      .insert(tabGroups)
      .values({
        id: groupId,
        userId,
        title: g.title,
        color: g.color ?? null,
        parentId: g.parent_id ?? null,
        isFolder: Boolean(g.is_folder),
        position: g.position ?? 0,
        tags: g.tags ? JSON.stringify(g.tags) : null,
        createdAt: g.created_at ?? new Date().toISOString(),
        updatedAt: g.updated_at ?? new Date().toISOString(),
      })
      .onConflictDoNothing({ target: tabGroups.id });

    if (g.items?.length) {
      for (const item of g.items) {
        const itemId = sanitizeId(item.id) || crypto.randomUUID();
        await db
          .insert(tabGroupItems)
          .values({
            id: itemId,
            groupId,
            title: item.title,
            url: item.url,
            favicon: item.favicon ?? null,
            position: item.position ?? 0,
            createdAt: item.created_at ?? new Date().toISOString(),
          })
          .onConflictDoNothing({ target: tabGroupItems.id });
      }
    }
  }
}

async function handler(request: NextRequest, userId: string) {
  const body = (await request.json()) as TMarksExportData | null;
  if (!body) return badRequest('Invalid import payload');

  const result: ImportResult = {
    bookmarks: body.bookmarks?.length ?? 0,
    tags: body.tags?.length ?? 0,
    tab_groups: body.tab_groups?.length ?? 0,
    tab_group_items: body.tab_groups?.reduce<number>((acc, group) => acc + (group.items?.length ?? 0), 0) ?? 0,
  };

  const tagMap = await upsertTags(userId, body.tags ?? []);
  await upsertBookmarks(userId, body.bookmarks ?? [], tagMap);
  await upsertTabGroups(userId, body.tab_groups ?? []);

  return created({ message: 'Import completed', stats: result });
}

export const POST = withErrorHandling(
  withAuth(async (request, ctx) => handler(request, ctx.userId)),
);


