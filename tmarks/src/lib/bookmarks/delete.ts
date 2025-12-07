import { eq } from 'drizzle-orm';
import { bookmarkImages, bookmarkSnapshots } from '@/lib/db/schema';
import { storage, type StorageProvider } from '@/lib/storage';

interface AssetRecord {
  key: string | null;
}

export function collectAssetKeys(records: AssetRecord[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const record of records) {
    if (!record.key) continue;
    if (seen.has(record.key)) continue;
    seen.add(record.key);
    keys.push(record.key);
  }
  return keys;
}

export async function deleteAssetsFromRecords(
  records: AssetRecord[],
  provider: StorageProvider = storage,
): Promise<void> {
  const keys = collectAssetKeys(records);
  for (const key of keys) {
    try {
      await provider.delete(key);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to delete asset key', key, error);
    }
  }
}

export async function deleteBookmarkAssets(
  bookmarkId: string,
  provider: StorageProvider = storage,
): Promise<void> {
  const { db } = await import('@/lib/db');

  const snapshotRows = await db
    .select({ key: bookmarkSnapshots.r2Key })
    .from(bookmarkSnapshots)
    .where(eq(bookmarkSnapshots.bookmarkId, bookmarkId));

  const imageRows = await db
    .select({ key: bookmarkImages.r2Key })
    .from(bookmarkImages)
    .where(eq(bookmarkImages.bookmarkId, bookmarkId));

  await deleteAssetsFromRecords([...snapshotRows, ...imageRows], provider);

  await db.delete(bookmarkSnapshots).where(eq(bookmarkSnapshots.bookmarkId, bookmarkId));
  await db.delete(bookmarkImages).where(eq(bookmarkImages.bookmarkId, bookmarkId));
}


