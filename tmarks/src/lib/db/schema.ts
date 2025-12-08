import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestampString = (name: string) => timestamp(name, { mode: 'string', withTimezone: true });

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull(),
    email: text('email'),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('user'),
    publicShareEnabled: boolean('public_share_enabled').notNull().default(false),
    publicSlug: text('public_slug'),
    publicPageTitle: text('public_page_title'),
    publicPageDescription: text('public_page_description'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    usernameLowerIdx: index('idx_users_username_lower').on(sql`lower(${table.username})`),
    emailLowerIdx: index('idx_users_email_lower').on(sql`lower(${table.email})`),
    roleIdx: index('idx_users_role').on(table.role),
    publicSlugIdx: uniqueIndex('idx_users_public_slug').on(table.publicSlug),
  }),
);

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: timestampString('expires_at').notNull(),
    revokedAt: timestampString('revoked_at'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_auth_tokens_user_id').on(table.userId),
    hashIdx: index('idx_auth_tokens_hash').on(table.refreshTokenHash),
    expiresIdx: index('idx_auth_tokens_expires').on(table.expiresAt),
  }),
);

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('light'),
  pageSize: integer('page_size').notNull().default(30),
  viewMode: text('view_mode').notNull().default('list'),
  density: text('density').notNull().default('normal'),
  tagLayout: text('tag_layout').notNull().default('grid'),
  sortBy: text('sort_by').notNull().default('popular'),
  searchAutoClearSeconds: integer('search_auto_clear_seconds').notNull().default(15),
  tagSelectionAutoClearSeconds: integer('tag_selection_auto_clear_seconds').notNull().default(30),
  enableSearchAutoClear: boolean('enable_search_auto_clear').notNull().default(true),
  enableTagSelectionAutoClear: boolean('enable_tag_selection_auto_clear').notNull().default(false),
  defaultBookmarkIcon: text('default_bookmark_icon').notNull().default('gradient-glow'),
  snapshotRetentionCount: integer('snapshot_retention_count').notNull().default(5),
  snapshotAutoCreate: boolean('snapshot_auto_create').notNull().default(false),
  snapshotAutoDedupe: boolean('snapshot_auto_dedupe').notNull().default(true),
  snapshotAutoCleanupDays: integer('snapshot_auto_cleanup_days').notNull().default(0),
  updatedAt: timestampString('updated_at').notNull().defaultNow(),
});

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    url: text('url').notNull(),
    description: text('description'),
    coverImage: text('cover_image'),
  coverImageId: text('cover_image_id'),
    favicon: text('favicon'),
    isPinned: boolean('is_pinned').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    clickCount: integer('click_count').notNull().default(0),
    lastClickedAt: timestampString('last_clicked_at'),
    hasSnapshot: boolean('has_snapshot').notNull().default(false),
    latestSnapshotAt: timestampString('latest_snapshot_at'),
    snapshotCount: integer('snapshot_count').notNull().default(0),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
    deletedAt: timestampString('deleted_at'),
  },
  (table) => ({
    userCreatedIdx: index('idx_bookmarks_user_created').on(table.userId, table.createdAt),
    userUrlIdx: uniqueIndex('idx_bookmarks_user_url').on(table.userId, table.url),
    urlIdx: index('idx_bookmarks_url').on(table.url),
    userDeletedIdx: index('idx_bookmarks_user_deleted').on(table.userId, table.deletedAt),
    pinnedIdx: index('idx_bookmarks_pinned').on(table.userId, table.isPinned, table.createdAt),
    clickCountIdx: index('idx_bookmarks_click_count').on(table.userId, table.clickCount),
    lastClickedIdx: index('idx_bookmarks_last_clicked').on(table.userId, table.lastClickedAt),
    archivedCreatedIdx: index('idx_bookmarks_user_archived_created').on(
      table.userId,
      table.isArchived,
      table.createdAt,
    ),
    archivedUpdatedIdx: index('idx_bookmarks_user_archived_updated').on(
      table.userId,
      table.isArchived,
      table.updatedAt,
    ),
    archivedPinnedCreatedIdx: index('idx_bookmarks_user_archived_pinned_created').on(
      table.userId,
      table.isArchived,
      table.isPinned,
      table.createdAt,
    ),
    archivedPinnedUpdatedIdx: index('idx_bookmarks_user_archived_pinned_updated').on(
      table.userId,
      table.isArchived,
      table.isPinned,
      table.updatedAt,
    ),
    archivedPinnedClicksIdx: index('idx_bookmarks_user_archived_pinned_clicks').on(
      table.userId,
      table.isArchived,
      table.isPinned,
      table.clickCount,
      table.lastClickedAt,
    ),
    userDeletedCreatedIdx: index('idx_bookmarks_user_deleted_created').on(
      table.userId,
      table.deletedAt,
      table.createdAt,
    ),
    hasSnapshotIdx: index('idx_bookmarks_has_snapshot').on(table.userId, table.hasSnapshot, table.createdAt),
    coverImageIdIdx: index('idx_bookmarks_cover_image_id').on(table.coverImageId),
  }),
);

export const bookmarkClickEvents = pgTable(
  'bookmark_click_events',
  {
    id: serial('id').primaryKey(),
    bookmarkId: uuid('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clickedAt: timestampString('clicked_at').notNull().defaultNow(),
  },
  (table) => ({
    userClickedIdx: index('idx_bookmark_click_events_user_clicked_at').on(table.userId, table.clickedAt),
    bookmarkClickedIdx: index('idx_bookmark_click_events_bookmark_clicked_at').on(
      table.bookmarkId,
      table.clickedAt,
    ),
  }),
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    clickCount: integer('click_count').notNull().default(0),
    lastClickedAt: timestampString('last_clicked_at'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
    deletedAt: timestampString('deleted_at'),
  },
  (table) => ({
    userNameIdx: index('idx_tags_user_name').on(table.userId, table.name),
    userDeletedIdx: index('idx_tags_user_deleted').on(table.userId, table.deletedAt),
    clickCountIdx: index('idx_tags_click_count').on(table.userId, table.clickCount),
    lastClickedIdx: index('idx_tags_last_clicked').on(table.userId, table.lastClickedAt),
  }),
);

export const bookmarkTags = pgTable(
  'bookmark_tags',
  {
    bookmarkId: uuid('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestampString('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ name: 'bookmark_tags_pk', columns: [table.bookmarkId, table.tagId] }),
    tagUserIdx: index('idx_bookmark_tags_tag_user').on(table.tagId, table.userId),
    bookmarkIdx: index('idx_bookmark_tags_bookmark').on(table.bookmarkId),
  }),
);

export const bookmarkSnapshots = pgTable(
  'bookmark_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookmarkId: uuid('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    isLatest: boolean('is_latest').notNull().default(false),
    contentHash: text('content_hash').notNull(),
    r2Key: text('r2_key').notNull(),
    r2Bucket: text('r2_bucket').notNull().default('tmarks-snapshots'),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull().default('text/html'),
    snapshotUrl: text('snapshot_url').notNull(),
    snapshotTitle: text('snapshot_title').notNull(),
    snapshotStatus: text('snapshot_status').notNull().default('completed'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    bookmarkIdIdx: index('idx_bookmark_snapshots_bookmark_id').on(table.bookmarkId),
    userIdIdx: index('idx_bookmark_snapshots_user_id').on(table.userId),
    createdAtIdx: index('idx_bookmark_snapshots_created_at').on(table.createdAt),
    contentHashIdx: index('idx_bookmark_snapshots_content_hash').on(table.contentHash),
    bookmarkLatestIdx: index('idx_bookmark_snapshots_bookmark_latest').on(table.bookmarkId, table.isLatest),
    bookmarkVersionIdx: index('idx_bookmark_snapshots_bookmark_version').on(table.bookmarkId, table.version),
  }),
);

export const bookmarkImages = pgTable(
  'bookmark_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookmarkId: uuid('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    imageHash: text('image_hash').notNull(),
    r2Key: text('r2_key').notNull(),
    r2Bucket: text('r2_bucket').notNull().default('tmarks-snapshots'),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    originalUrl: text('original_url').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    bookmarkIdIdx: index('idx_bookmark_images_bookmark_id').on(table.bookmarkId),
    userIdIdx: index('idx_bookmark_images_user_id').on(table.userId),
    hashIdx: index('idx_bookmark_images_hash').on(table.imageHash),
    createdAtIdx: index('idx_bookmark_images_created_at').on(table.createdAt),
  }),
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    permissions: text('permissions').notNull(),
    status: text('status').notNull().default('active'),
    expiresAt: timestampString('expires_at'),
    lastUsedAt: timestampString('last_used_at'),
    lastUsedIp: text('last_used_ip'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_api_keys_user').on(table.userId),
    hashIdx: index('idx_api_keys_hash').on(table.keyHash),
    statusIdx: index('idx_api_keys_status').on(table.userId, table.status),
  }),
);

export const apiKeyLogs = pgTable(
  'api_key_logs',
  {
    id: serial('id').primaryKey(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    method: text('method').notNull(),
    status: integer('status').notNull(),
    ip: text('ip'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
  },
  (table) => ({
    apiKeyIdx: index('idx_api_logs_key').on(table.apiKeyId, table.createdAt),
    userIdx: index('idx_api_logs_user').on(table.userId, table.createdAt),
  }),
);

export const tabGroups = pgTable(
  'tab_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    parentId: uuid('parent_id'),
    isFolder: boolean('is_folder').notNull().default(false),
    position: integer('position').notNull().default(0),
    color: text('color'),
    tags: text('tags'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestampString('deleted_at'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index('idx_tab_groups_user_created').on(table.userId, table.createdAt),
    userIdIdx: index('idx_tab_groups_user_id').on(table.userId),
    parentIdIdx: index('idx_tab_groups_parent_id').on(table.parentId),
    isFolderIdx: index('idx_tab_groups_is_folder').on(table.isFolder),
    userParentIdx: index('idx_tab_groups_user_parent').on(table.userId, table.parentId),
    parentPositionIdx: index('idx_tab_groups_parent_position').on(table.parentId, table.position),
    userParentPositionIdx: index('idx_tab_groups_user_parent_position').on(
      table.userId,
      table.parentId,
      table.position,
    ),
    deletedIdx: index('idx_tab_groups_deleted').on(table.userId, table.isDeleted),
  }),
);

export const tabGroupItems = pgTable(
  'tab_group_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => tabGroups.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    url: text('url').notNull(),
    favicon: text('favicon'),
    position: integer('position').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),
    isTodo: boolean('is_todo').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestampString('created_at').notNull().defaultNow(),
  },
  (table) => ({
    groupIdIdx: index('idx_tab_group_items_group_id').on(table.groupId, table.position),
    groupCreatedIdx: index('idx_tab_group_items_group_created').on(table.groupId, table.createdAt),
    pinnedIdx: index('idx_tab_group_items_pinned').on(table.groupId, table.isPinned, table.position),
    archivedIdx: index('idx_tab_group_items_archived').on(table.groupId, table.isArchived, table.position),
    notArchivedIdx: index('idx_tab_group_items_not_archived').on(table.groupId, table.isArchived),
  }),
);

export const shares = pgTable(
  'shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => tabGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shareToken: text('share_token').notNull().unique(),
    isPublic: boolean('is_public').default(true),
    viewCount: integer('view_count').default(0),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    expiresAt: timestampString('expires_at'),
  },
  (table) => ({
    tokenIdx: index('idx_shares_token').on(table.shareToken),
    groupIdx: index('idx_shares_group_id').on(table.groupId),
    userIdx: index('idx_shares_user_id').on(table.userId),
  }),
);

export const statistics = pgTable(
  'statistics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    statDate: text('stat_date').notNull(),
    groupsCreated: integer('groups_created').default(0),
    groupsDeleted: integer('groups_deleted').default(0),
    itemsAdded: integer('items_added').default(0),
    itemsDeleted: integer('items_deleted').default(0),
    sharesCreated: integer('shares_created').default(0),
    createdAt: timestampString('created_at').notNull().defaultNow(),
    updatedAt: timestampString('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userDateUnique: uniqueIndex('idx_statistics_user_date').on(table.userId, table.statDate),
    userIdIdx: index('idx_statistics_user_id').on(table.userId),
    dateIdx: index('idx_statistics_date').on(table.statDate),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    payload: text('payload'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestampString('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_audit_logs_user').on(table.userId, table.createdAt),
    eventIdx: index('idx_audit_logs_event').on(table.eventType, table.createdAt),
    createdIdx: index('idx_audit_logs_created').on(table.createdAt),
  }),
);

export const registrationLimits = pgTable('registration_limits', {
  date: text('date').primaryKey(),
  count: integer('count').notNull().default(0),
  updatedAt: timestampString('updated_at').notNull().defaultNow(),
});

export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  appliedAt: timestampString('applied_at').notNull().defaultNow(),
});

