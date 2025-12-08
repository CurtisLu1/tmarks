import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
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
import { incrementStatistics } from '@/lib/statistics';
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

interface ParsedHtmlBookmark {
  title: string;
  url: string;
  tags: string[];
  addDate?: number; // Unix timestamp from ADD_DATE attribute
  description?: string;
}

function sanitizeId(id: string | undefined): string | undefined {
  return id?.trim() || undefined;
}

/**
 * Parse HTML bookmarks with folder structure and timestamps
 * Supports: folder_as_tag, preserve_timestamps, TAGS attribute
 */
function parseHtmlBookmarks(
  html: string,
  options: { folder_as_tag?: boolean; preserve_timestamps?: boolean }
): ParsedHtmlBookmark[] {
  const results: ParsedHtmlBookmark[] = [];
  const folderStack: string[] = [];

  // Split content into lines for easier parsing
  const lines = html.split(/\n|\r\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect folder start: <H3>Folder Name</H3>
    const folderMatch = line.match(/<H3[^>]*>([^<]+)<\/H3>/i);
    if (folderMatch) {
      const folderName = folderMatch[1]?.trim();
      if (folderName && folderName.length > 0) {
        folderStack.push(folderName);
      }
      continue;
    }

    // Detect folder end: </DL>
    if (/<\/DL>/i.test(line)) {
      folderStack.pop();
      continue;
    }

    // Parse anchor tags: <A HREF="..." ADD_DATE="..." TAGS="...">Title</A>
    const anchorMatch = line.match(/<A\s+([^>]*)>([^<]*)<\/A>/i);
    if (anchorMatch) {
      const attrs = anchorMatch[1] || '';
      const title = anchorMatch[2]?.trim() || '';

      // Extract HREF
      const hrefMatch = attrs.match(/HREF=["']([^"']+)["']/i);
      const url = hrefMatch?.[1]?.trim() || '';

      if (!url) continue;

      // Extract ADD_DATE timestamp
      let addDate: number | undefined;
      if (options.preserve_timestamps !== false) {
        const addDateMatch = attrs.match(/ADD_DATE=["']?(\d+)["']?/i);
        if (addDateMatch?.[1]) {
          addDate = parseInt(addDateMatch[1], 10);
        }
      }

      // Extract TAGS attribute (comma-separated)
      const tagsMatch = attrs.match(/TAGS=["']([^"']+)["']/i);
      let bookmarkTags: string[] = [];
      if (tagsMatch?.[1]) {
        bookmarkTags = tagsMatch[1]
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      }

      // Add folder names as tags if folder_as_tag is enabled
      if (options.folder_as_tag !== false && folderStack.length > 0) {
        // Add all folder names in the stack as tags
        for (const folder of folderStack) {
          if (!bookmarkTags.includes(folder)) {
            bookmarkTags.push(folder);
          }
        }
      }

      // Check for description in next line: <DD>description
      let description: string | undefined;
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine) {
          const ddMatch = nextLine.match(/<DD>(.+)/i);
          if (ddMatch?.[1]) {
            description = ddMatch[1].trim();
          }
        }
      }

      results.push({
        title: title || url,
        url,
        tags: bookmarkTags,
        addDate,
        description,
      });
    }
  }

  return results;
}

async function upsertTags(
  userId: string,
  incoming: ExportTag[],
  options?: { create_missing_tags?: boolean }
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  const createMissing = options?.create_missing_tags ?? true;

  for (const tag of incoming) {
    // Check if tag.id is a valid UUID, otherwise generate one
    const isValidUuid = tag.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tag.id);
    const tagId = isValidUuid ? tag.id : crypto.randomUUID();

    if (createMissing) {
      // Check if tag with this name already exists for user
      const existingTag = await db.query.tags.findFirst({
        where: and(
          eq(tags.userId, userId),
          eq(tags.name, tag.name)
        ),
      });

      if (existingTag) {
        // Tag already exists, use its ID
        idMap.set(tag.id ?? tag.name, existingTag.id);
        idMap.set(tag.name, existingTag.id);
        continue;
      }

      // Insert new tag
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
    }
    // Map both the original id/name and the tag name to the actual UUID
    idMap.set(tag.id ?? tag.name, tagId);
    idMap.set(tag.name, tagId);
  }
  return idMap;
}

/**
 * Create tags from bookmark tag names if they don't exist
 */
async function ensureTagsExist(
  userId: string,
  tagNames: string[]
): Promise<Map<string, string>> {
  const tagIdMap = new Map<string, string>();
  const now = new Date().toISOString();

  for (const name of tagNames) {
    if (!name || name.length === 0) continue;

    // Check if tag already exists (case-insensitive)
    const existingTag = await db.query.tags.findFirst({
      where: and(
        eq(tags.userId, userId),
        eq(tags.name, name)
      ),
    });

    if (existingTag) {
      tagIdMap.set(name, existingTag.id);
    } else {
      // Create new tag
      const tagId = crypto.randomUUID();
      await db
        .insert(tags)
        .values({
          id: tagId,
          userId,
          name,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      tagIdMap.set(name, tagId);
    }
  }

  return tagIdMap;
}

async function upsertBookmarks(
  userId: string,
  incoming: ExportBookmark[],
  tagMap: Map<string, string>,
  options?: { skip_duplicates?: boolean; create_missing_tags?: boolean; preserve_timestamps?: boolean }
): Promise<{ inserted: number; skipped: number; failed: number; createdTagCount: number }> {
  const skipDuplicates = options?.skip_duplicates ?? true;
  const createMissingTags = options?.create_missing_tags ?? true;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let createdTagCount = 0;

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
          isPinned: b.is_pinned ?? false,
          isArchived: b.is_archived ?? false,
          isPublic: b.is_public ?? false,
          createdAt: b.created_at ?? new Date().toISOString(),
          updatedAt: b.updated_at ?? new Date().toISOString(),
        })
        .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.url] })
        .returning({ id: bookmarks.id });

      if (result.length === 0) {
        // Conflict - URL already exists
        skipped++;
        continue;
      }

      inserted++;

      // Handle tags - either from tagMap or create new ones
      if (b.tags?.length) {
        // Collect tag names that need to be created
        const tagNamesToCreate: string[] = [];
        const existingTagIds: string[] = [];

        for (const sourceTagId of b.tags) {
          const tagId = tagMap.get(sourceTagId);
          if (tagId) {
            existingTagIds.push(tagId);
          } else if (createMissingTags) {
            // Treat sourceTagId as a tag name to create
            tagNamesToCreate.push(sourceTagId);
          }
        }

        // Create missing tags
        if (tagNamesToCreate.length > 0) {
          const newTagMap = await ensureTagsExist(userId, tagNamesToCreate);
          for (const [name, tagId] of newTagMap) {
            tagMap.set(name, tagId);
            existingTagIds.push(tagId);
            createdTagCount++;
          }
        }

        // Link tags to bookmark
        for (const tagId of existingTagIds) {
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

  return { inserted, skipped, failed, createdTagCount };
}

async function upsertTabGroups(userId: string, incoming: ExportTabGroup[]) {
  let groupCount = 0;
  let itemCount = 0;

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

    groupCount++;

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
        itemCount++;
      }
    }
  }

  return { groupCount, itemCount };
}

async function handler(request: NextRequest, userId: string) {
  const payload = (await request.json()) as
    | { format?: ImportFormat; content?: string; options?: ImportOptions }
    | null;

  if (!payload?.format || !payload.content) {
    return badRequest('Invalid import payload');
  }

  const options = payload.options ?? {};
  let body: TMarksExportData | null = null;

  if (payload.format === 'json' || payload.format === 'tmarks') {
    try {
      body = JSON.parse(payload.content) as TMarksExportData;
    } catch {
      return badRequest('Invalid JSON content');
    }
  } else if (payload.format === 'html') {
    // Parse HTML with folder structure and timestamps
    const htmlOptions = options as { folder_as_tag?: boolean; preserve_timestamps?: boolean };
    const parsedBookmarks = parseHtmlBookmarks(payload.content, {
      folder_as_tag: htmlOptions.folder_as_tag,
      preserve_timestamps: htmlOptions.preserve_timestamps,
    });

    if (!parsedBookmarks.length) {
      return badRequest('No bookmarks found in HTML');
    }

    const now = new Date().toISOString();

    // Collect all unique tag names from parsed bookmarks
    const allTagNames = new Set<string>();
    for (const b of parsedBookmarks) {
      for (const tag of b.tags) {
        allTagNames.add(tag);
      }
    }

    body = {
      version: '1.0.0',
      exported_at: now,
      user: {
        id: userId,
        username: 'import',
        created_at: now,
      },
      bookmarks: parsedBookmarks.map((b) => {
        // Convert ADD_DATE (Unix timestamp in seconds) to ISO string
        let createdAt = now;
        if (b.addDate && htmlOptions.preserve_timestamps !== false) {
          createdAt = new Date(b.addDate * 1000).toISOString();
        }

        return {
          id: crypto.randomUUID(),
          title: b.title,
          url: b.url,
          description: b.description,
          cover_image: undefined,
          favicon: undefined,
          tags: b.tags, // Tag names will be processed in upsertBookmarks
          is_pinned: false,
          is_archived: false,
          is_public: false,
          created_at: createdAt,
          updated_at: createdAt,
        };
      }) as ExportBookmark[],
      tags: Array.from(allTagNames).map((name) => ({
        id: name, // Use name as id for matching in upsertBookmarks
        name,
        color: undefined,
        created_at: now,
        updated_at: now,
      })) as ExportTag[],
      tab_groups: [],
      metadata: {
        total_bookmarks: parsedBookmarks.length,
        total_tags: allTagNames.size,
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

  const tagMap = await upsertTags(userId, body.tags ?? [], options);
  const bookmarkResult = await upsertBookmarks(userId, body.bookmarks ?? [], tagMap, options);
  const tabGroupResult = await upsertTabGroups(userId, body.tab_groups ?? []);

  // Track statistics
  if (bookmarkResult.inserted > 0 || tabGroupResult.groupCount > 0) {
    await incrementStatistics(userId, {
      groupsCreated: tabGroupResult.groupCount,
      itemsAdded: tabGroupResult.itemCount,
    });
  }

  const response: ImportResponse = {
    success: bookmarkResult.inserted,
    failed: bookmarkResult.failed,
    skipped: bookmarkResult.skipped,
    total: result.bookmarks,
    errors: [],
    created_bookmarks: [],
    created_tags: Array.from(new Set(Array.from(tagMap.values()))),
    created_tab_groups: [],
    tab_groups_success: tabGroupResult.groupCount,
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
