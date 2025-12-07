import { generateUUID } from './crypto'

/**
 * 创建或链接标签到书签
 * 自动处理标签的创建、查找和链接
 * 
 * @param db - D1 数据库实例
 * @param bookmarkId - 书签 ID
 * @param tagNames - 标签名称数组
 * @param userId - 用户 ID
 */
export async function createOrLinkTags(
  db: D1Database,
  bookmarkId: string,
  tagNames: string[],
  userId: string
): Promise<void> {
  if (!tagNames || tagNames.length === 0) return

  const now = new Date().toISOString()

  // 优化：批量查询所有标签，避免 N+1 查询
  const trimmedNames = tagNames.map(name => name.trim()).filter(name => name.length > 0)
  if (trimmedNames.length === 0) return

  // 构建 IN 查询的占位符
  const placeholders = trimmedNames.map(() => '?').join(',')
  const { results: existingTags } = await db
    .prepare(`SELECT id, name FROM tags WHERE user_id = ? AND LOWER(name) IN (${placeholders}) AND deleted_at IS NULL`)
    .bind(userId, ...trimmedNames.map(name => name.toLowerCase()))
    .all<{ id: string; name: string }>()

  // 创建标签名称到 ID 的映射（不区分大小写）
  const tagMap = new Map<string, string>()
  for (const tag of existingTags || []) {
    tagMap.set(tag.name.toLowerCase(), tag.id)
  }

  // 找出需要创建的新标签
  const tagsToCreate = trimmedNames.filter(name => !tagMap.has(name.toLowerCase()))

  // 批量创建新标签
  if (tagsToCreate.length > 0) {
    // 使用事务批量插入（D1 支持批量操作）
    const insertStatements = tagsToCreate.map(name => {
      const tagId = generateUUID()
      tagMap.set(name.toLowerCase(), tagId)
      return db
        .prepare('INSERT INTO tags (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(tagId, userId, name, now, now)
    })

    // 批量执行插入
    await db.batch(insertStatements)
  }

  // 批量链接标签到书签
  const linkStatements = trimmedNames.map(name => {
    const tagId = tagMap.get(name.toLowerCase())
    if (!tagId) {
      console.error(`[createOrLinkTags] Tag ID not found for: ${name}`)
      return null
    }
    return db
      .prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id, user_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(bookmarkId, tagId, userId, now)
  }).filter(stmt => stmt !== null) as D1PreparedStatement[]

  if (linkStatements.length > 0) {
    await db.batch(linkStatements)
  }
}
