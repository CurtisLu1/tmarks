import { db } from '@/lib/db';
import { statistics } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export type StatisticField =
    | 'groupsCreated'
    | 'groupsDeleted'
    | 'itemsAdded'
    | 'itemsDeleted'
    | 'sharesCreated';

/**
 * Increment a statistic counter for a user on the current date.
 * Creates a new record if none exists for today, otherwise updates existing.
 */
export async function incrementStatistic(
    userId: string,
    field: StatisticField,
    count: number = 1
): Promise<void> {
    if (count === 0) return;

    const today = new Date().toISOString().split('T')[0]!;
    const now = new Date().toISOString();

    // Use upsert pattern - try insert with conflict update
    await db
        .insert(statistics)
        .values({
            userId,
            statDate: today,
            groupsCreated: field === 'groupsCreated' ? count : 0,
            groupsDeleted: field === 'groupsDeleted' ? count : 0,
            itemsAdded: field === 'itemsAdded' ? count : 0,
            itemsDeleted: field === 'itemsDeleted' ? count : 0,
            sharesCreated: field === 'sharesCreated' ? count : 0,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [statistics.userId, statistics.statDate],
            set: {
                [field]: sql`COALESCE(${statistics[field]}, 0) + ${count}`,
                updatedAt: now,
            },
        });
}

/**
 * Increment multiple statistics at once
 */
export async function incrementStatistics(
    userId: string,
    updates: Partial<Record<StatisticField, number>>
): Promise<void> {
    for (const [field, count] of Object.entries(updates)) {
        if (count && count > 0) {
            await incrementStatistic(userId, field as StatisticField, count);
        }
    }
}
