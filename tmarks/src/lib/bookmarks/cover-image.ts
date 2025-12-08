import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { bookmarkImages } from '@/lib/db/schema';
import { storage } from '@/lib/storage';
import { eq } from 'drizzle-orm';

/**
 * Hash image buffer to SHA-256 hex string
 */
function hashImage(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Result of cover image processing
 */
export interface ProcessCoverImageResult {
    url: string;      // The final URL (MinIO URL if successful, original if failed)
    imageId?: string; // The ID in bookmark_images table if successful
    isLocal?: boolean; // Whether the image is now stored locally (MinIO)
}

/**
 * Download and store a cover image to MinIO
 */
export async function processCoverImage(
    originalUrl: string,
    bookmarkId: string,
    userId: string
): Promise<ProcessCoverImageResult> {
    // Ignore empty URLs
    if (!originalUrl) {
        return { url: originalUrl };
    }

    // Check if URL is already internal (hosted by us)
    const storageBase = process.env.STORAGE_PUBLIC_URL;
    if (storageBase && originalUrl.startsWith(storageBase)) {
        return { url: originalUrl, isLocal: true };
    }

    try {
        // 1. Download Image
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(originalUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': new URL(originalUrl).origin,
            },
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.warn(`[CoverImage] Failed to download image: ${originalUrl}, status: ${response.status}`);
            return { url: originalUrl };
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
            return { url: originalUrl };
        }

        // 2. Hash & Deduplication
        const hash = hashImage(buffer);

        const existingImage = await db.query.bookmarkImages.findFirst({
            where: eq(bookmarkImages.imageHash, hash),
        });

        let storageKey: string;
        const fileSize = buffer.length;

        if (existingImage) {
            console.log(`[CoverImage] Image deduplicated (hash: ${hash})`);
            storageKey = existingImage.r2Key;
        } else {
            // 3. Upload to MinIO
            let ext = 'jpg';
            if (contentType.includes('png')) ext = 'png';
            else if (contentType.includes('gif')) ext = 'gif';
            else if (contentType.includes('webp')) ext = 'webp';
            else if (contentType.includes('svg')) ext = 'svg';

            storageKey = `covers/${userId}/${hash}.${ext}`;

            console.log(`[CoverImage] Uploading new image to: ${storageKey}`);
            await storage.upload(storageKey, buffer, {
                contentType,
                metadata: {
                    originalUrl,
                }
            });
        }

        // 4. Save metadata to DB
        const [savedRecord] = await db.insert(bookmarkImages).values({
            bookmarkId,
            userId,
            imageHash: hash,
            r2Key: storageKey,
            fileSize,
            mimeType: contentType,
            originalUrl,
        }).returning();

        if (!savedRecord) {
            throw new Error('Failed to save bookmark image record');
        }

        // Construct final publicly accessible URL
        const finalUrl = storageBase ? `${storageBase}/${storageKey}` : storageKey;

        return {
            url: finalUrl,
            imageId: savedRecord.id,
            isLocal: true
        };

    } catch (error) {
        console.error('[CoverImage] Error processing:', error);
        return { url: originalUrl };
    }
}
