import { ilike, and, eq } from 'drizzle-orm';
import { generateUUID } from './crypto';
import { bookmarkTags, tags } from './db/schema';
import { db } from './db';

interface CreateOrLinkTagsOptions {
  bookmarkId: string;
  tagNames: string[];
  userId: string;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
  }
  return result;
}

export async function createOrLinkTags({ bookmarkId, tagNames, userId }: CreateOrLinkTagsOptions) {
  const names = uniqueNames(tagNames);
  if (names.length === 0) return;

  const now = new Date().toISOString();
  const tagIdMap = new Map<string, string>(); // lowerName -> tagId

  for (const name of names) {
    const lowerName = name.toLowerCase();

    // 查找已存在的标签（忽略大小写）
    const existing = await db.query.tags.findFirst({
      columns: { id: true, name: true },
      where: and(eq(tags.userId, userId), ilike(tags.name, name)),
    });

    if (existing) {
      tagIdMap.set(lowerName, existing.id);
      continue;
    }

    const newTagId = generateUUID();
    await db.insert(tags).values({
      id: newTagId,
      userId,
      name,
      createdAt: now,
      updatedAt: now,
    });
    tagIdMap.set(lowerName, newTagId);
  }

  const linkValues = names
    .map((name) => {
      const lowerName = name.toLowerCase();
      const tagId = tagIdMap.get(lowerName);
      if (!tagId) return null;
      return {
        bookmarkId,
        tagId,
        userId,
        createdAt: now,
      };
    })
    .filter(Boolean) as Array<{ bookmarkId: string; tagId: string; userId: string; createdAt: string }>;

  if (linkValues.length === 0) return;

  // 去重链接
  for (const value of linkValues) {
    await db
      .insert(bookmarkTags)
      .values(value)
      .onConflictDoNothing({ target: [bookmarkTags.bookmarkId, bookmarkTags.tagId] });
  }
}


