import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/middleware/auth';
import { withErrorHandling } from '@/lib/api/error-handler';
import { badRequest } from '@/lib/api/response';
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
  ImportFormat,
  ImportOptions,
  ImportResult as ImportResponse,
} from '@shared/import-export-types';
import { NextResponse } from 'next/server';

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

async function upsertBookmarks(
  userId: string,
  incoming: ExportBookmark[],
  tagMap: Map<string, string>,
  options?: { skip_duplicates?: boolean }
): Promise<{ inserted: number; skipped: number; failed: number }> {
  const skipDuplicates = options?.skip_duplicates ?? true;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Deduplicate by URL within the import file - keep first occurrence
  const seenUrls = new Set<string>();
  const deduped = incoming.filter((b) => {
    if (seenUrls.has(b.url)) {
      skipped++;
      return false;
    }
    seenUrls.add(b.url);
    return true;
  });

  for (const b of deduped) {
    const bookmarkId = sanitizeId(b.id) || crypto.randomUUID();
    try {
      const result = await db
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
        .onConflictDoNothing()
        .returning();

      if (result.length === 0) {
        // Conflict occurred (duplicate URL in database)
        if (skipDuplicates) {
          skipped++;
          continue;
        } else {
          failed++;
          throw new Error(`Duplicate URL: ${b.url}`);
        }
      }

      inserted++;

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
    } catch (error) {
      if (skipDuplicates) {
        skipped++;
        continue;
      }
      failed++;
      throw error;
    }
  }

  return { inserted, skipped, failed };
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
  const payload = (await request.json()) as
    | { format?: ImportFormat; content?: string; options?: ImportOptions }
    | null;

  if (!payload?.format || !payload.content) {
    return badRequest('Invalid import payload');
  }

  let body: TMarksExportData | null = null;

  if (payload.format === 'json' || payload.format === 'tmarks') {
    try {
      body = JSON.parse(payload.content) as TMarksExportData;
    } catch {
      return badRequest('Invalid JSON content');
    }
  } else if (payload.format === 'html') {
    // 轻量级 HTML 书签解析（提取 <a> 标签）
    const anchors: Array<{ title: string; url: string }> = [];
    const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(payload.content)) !== null) {
      const url = match[1]?.trim() ?? '';
      const title = match[2]?.trim() || url;
      if (url) {
        anchors.push({ title, url });
      }
    }

    if (!anchors.length) {
      return badRequest('No bookmarks found in HTML');
    }

    const now = new Date().toISOString();
    body = {
      version: '1.0.0',
      exported_at: now,
      user: {
        id: userId,
        username: 'import',
        created_at: now,
      },
      bookmarks: anchors.map((a) => ({
        id: crypto.randomUUID(),
        title: a.title,
        url: a.url,
        description: undefined,
        cover_image: undefined,
        favicon: undefined,
        tags: [],
        is_pinned: false,
        is_archived: false,
        is_public: false,
        created_at: now,
        updated_at: now,
      })) as ExportBookmark[],
      tags: [],
      tab_groups: [],
      metadata: {
        total_bookmarks: anchors.length,
        total_tags: 0,
        export_format: 'html',
      },
    };
  } else {
    return badRequest('Unsupported import format');
  }

  if (!body) return badRequest('Invalid import payload');

  const result: ImportResult = {
    bookmarks: body.bookmarks?.length ?? 0,
    tags: body.tags?.length ?? 0,
    tab_groups: body.tab_groups?.length ?? 0,
    tab_group_items: body.tab_groups?.reduce<number>((acc, group) => acc + (group.items?.length ?? 0), 0) ?? 0,
  };

  const tagMap = await upsertTags(userId, body.tags ?? []);
  const bookmarkResult = await upsertBookmarks(userId, body.bookmarks ?? [], tagMap, payload.options);
  await upsertTabGroups(userId, body.tab_groups ?? []);

  const response: ImportResponse = {
    success: bookmarkResult.inserted,
    failed: bookmarkResult.failed,
    skipped: bookmarkResult.skipped,
    total: result.bookmarks,
    errors: [],
    created_bookmarks: [],
    created_tags: Array.from(new Set(Array.from(tagMap.values()))),
    created_tab_groups: [],
    tab_groups_success: result.tab_groups,
    tab_groups_failed: 0,
  };

  return NextResponse.json<ImportResponse>(response, { status: 201 });
}

export const POST = withErrorHandling(
  withAuth(async (request, ctx) => handler(request, ctx.userId)),
);

// 简单的导入预览/能力说明（不解析文件，不写库）
export const GET = withErrorHandling(
  withAuth(async (request) => {
    const format = request.nextUrl.searchParams.get('format');
    const preview = request.nextUrl.searchParams.get('preview') === 'true';

    if (!preview) {
      return badRequest('Preview only; use POST for import');
    }

    if (format && !['json', 'tmarks', 'html'].includes(format)) {
      return badRequest('Unsupported import format');
    }

    return NextResponse.json({
      supported_formats: ['json', 'tmarks', 'html'],
      max_size_mb: 50,
      notes: 'HTML 预览仅提供能力说明，实际导入请使用 POST 并携带文件内容',
    });
  }),
);


