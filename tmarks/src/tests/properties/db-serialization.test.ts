import { InferSelectModel } from 'drizzle-orm';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bookmarks, tags, users } from '@/lib/db/schema';

type UserEntity = InferSelectModel<typeof users>;
type BookmarkEntity = InferSelectModel<typeof bookmarks>;
type TagEntity = InferSelectModel<typeof tags>;

function isoTimestampArbitrary() {
  const min = Date.parse('2000-01-01T00:00:00.000Z');
  const max = Date.parse('2100-01-01T00:00:00.000Z');
  return fc
    .integer({ min, max })
    .map((ms) => new Date(ms).toISOString());
}

function expectJsonRoundTrip<T>(value: T) {
  const parsed = JSON.parse(JSON.stringify(value));
  expect(parsed).toEqual(value);
}

const userArbitrary: fc.Arbitrary<UserEntity> = fc.record({
  id: fc.uuid(),
  username: fc.string({ minLength: 1, maxLength: 64 }),
  email: fc.option(fc.emailAddress(), { nil: null }),
  passwordHash: fc.string({ minLength: 20, maxLength: 120 }),
  role: fc.constantFrom('user', 'admin'),
  publicShareEnabled: fc.boolean(),
  publicSlug: fc.option(fc.string({ minLength: 1, maxLength: 120 }), { nil: null }),
  publicPageTitle: fc.option(fc.string({ maxLength: 180 }), { nil: null }),
  publicPageDescription: fc.option(fc.string({ maxLength: 400 }), { nil: null }),
  createdAt: isoTimestampArbitrary(),
  updatedAt: isoTimestampArbitrary(),
});

const bookmarkArbitrary: fc.Arbitrary<BookmarkEntity> = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 180 }),
  url: fc.webUrl(),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  coverImage: fc.option(fc.webUrl(), { nil: null }),
  coverImageId: fc.option(fc.string({ maxLength: 128 }), { nil: null }),
  favicon: fc.option(fc.webUrl(), { nil: null }),
  isPinned: fc.boolean(),
  isArchived: fc.boolean(),
  isPublic: fc.boolean(),
  clickCount: fc.integer({ min: 0, max: 1_000_000 }),
  lastClickedAt: fc.option(isoTimestampArbitrary(), { nil: null }),
  hasSnapshot: fc.boolean(),
  latestSnapshotAt: fc.option(isoTimestampArbitrary(), { nil: null }),
  snapshotCount: fc.integer({ min: 0, max: 10_000 }),
  createdAt: isoTimestampArbitrary(),
  updatedAt: isoTimestampArbitrary(),
  deletedAt: fc.option(isoTimestampArbitrary(), { nil: null }),
});

const tagArbitrary: fc.Arbitrary<TagEntity> = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 80 }),
  color: fc.option(fc.string({ minLength: 1, maxLength: 32 }), { nil: null }),
  clickCount: fc.integer({ min: 0, max: 1_000_000 }),
  lastClickedAt: fc.option(isoTimestampArbitrary(), { nil: null }),
  createdAt: isoTimestampArbitrary(),
  updatedAt: isoTimestampArbitrary(),
  deletedAt: fc.option(isoTimestampArbitrary(), { nil: null }),
});

// Feature: dokploy-migration
// Property 1: Database Entity Serialization Round-Trip
// Validates: Requirements 1.4, 6.2
describe('属性测试: 数据库实体序列化往返保持等价', () => {
  it('User 实体 JSON 序列化/反序列化后字段保持一致', () => {
    fc.assert(
      fc.property(userArbitrary, (user) => {
        expectJsonRoundTrip(user);
      }),
      { numRuns: 100 },
    );
  });

  it('Bookmark 实体 JSON 序列化/反序列化后字段保持一致', () => {
    fc.assert(
      fc.property(bookmarkArbitrary, (bookmark) => {
        expectJsonRoundTrip(bookmark);
      }),
      { numRuns: 100 },
    );
  });

  it('Tag 实体 JSON 序列化/反序列化后字段保持一致', () => {
    fc.assert(
      fc.property(tagArbitrary, (tag) => {
        expectJsonRoundTrip(tag);
      }),
      { numRuns: 100 },
    );
  });
});

