import { NextRequest } from 'next/server';
import { and, eq, ilike, isNull } from 'drizzle-orm';
import { badRequest, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/error-handler';
import { withAuth } from '@/lib/api/middleware/auth';
import { db } from '@/lib/db';
import { tags } from '@/lib/db/schema';
import { sanitizeString } from '@/lib/validation';

interface CreateTagInput {
    name: string;
    color?: string;
}

interface BatchCreateTagsRequest {
    tags: CreateTagInput[];
    skip_duplicates?: boolean;
}

interface BatchResult {
    success: boolean;
    tag?: typeof tags.$inferSelect;
    error?: { code: string; message: string };
}

async function handlePost(request: NextRequest, userId: string) {
    const body = (await request.json()) as BatchCreateTagsRequest;

    if (!body.tags || !Array.isArray(body.tags) || body.tags.length === 0) {
        return badRequest('Invalid request: tags array is required');
    }

    if (body.tags.length > 100) {
        return badRequest('Maximum 100 tags per batch request');
    }

    const skipDuplicates = body.skip_duplicates ?? true;
    const results: BatchResult[] = [];
    const now = new Date().toISOString();

    for (const input of body.tags) {
        if (!input.name || typeof input.name !== 'string') {
            results.push({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Tag name is required' },
            });
            continue;
        }

        const name = sanitizeString(input.name, 50);
        const color = input.color ? sanitizeString(input.color, 20) : null;

        // Check for existing tag
        const existingTag = await db.query.tags.findFirst({
            where: and(eq(tags.userId, userId), ilike(tags.name, name), isNull(tags.deletedAt)),
        });

        if (existingTag) {
            if (skipDuplicates) {
                results.push({ success: true, tag: existingTag });
            } else {
                results.push({
                    success: false,
                    error: { code: 'DUPLICATE_TAG', message: `Tag "${name}" already exists` },
                });
            }
            continue;
        }

        // Create new tag
        const [newTag] = await db
            .insert(tags)
            .values({
                userId,
                name,
                color,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        results.push({ success: true, tag: newTag });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return success({
        results,
        summary: {
            total: results.length,
            succeeded,
            failed,
        },
    });
}

export const POST = withErrorHandling(
    withAuth(async (request, ctx) => handlePost(request, ctx.userId))
);
