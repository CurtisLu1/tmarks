# TMarks 缓存系统

## 📖 概述

TMarks 缓存系统提供灵活、强健、成本可控的多层缓存解决方案。

### 核心特性

- ✅ **4 级配置** - 从无缓存到激进缓存
- ✅ **批量操作零成本** - 批量导入不写缓存
- ✅ **优雅降级** - KV 故障自动降级到 D1
- ✅ **多层缓存** - 内存 + KV + D1
- ✅ **模块化设计** - 易于维护和扩展

## 🏗️ 架构

```
用户请求
  ↓
L1: Worker 内存缓存 (<1ms)
  ↓ 未命中
L2: KV 边缘缓存 (<10ms)
  ↓ 未命中
L3: D1 数据库 (50-200ms)
```

## 📁 文件结构

```
cache/
├── types.ts           # 类型定义
├── config.ts          # 配置管理 (4 级预设)
├── strategies.ts      # 缓存策略 (键生成、判断)
├── service.ts         # 核心服务 (多层缓存、降级)
├── bookmark-cache.ts  # 书签缓存封装
├── index.ts           # 导出接口
└── README.md          # 本文档
```

## 🚀 快速开始

### 1. 配置

```toml
# wrangler.toml
[vars]
CACHE_LEVEL = "1"          # 0-3
ENABLE_KV_CACHE = "true"
```

### 2. 使用

```typescript
import { CacheService } from './lib/cache'
import { createBookmarkCacheManager } from './lib/cache/bookmark-cache'

// 初始化
const cache = new CacheService(env)
const bookmarkCache = createBookmarkCacheManager(cache)

// 获取缓存
const cached = await bookmarkCache.getBookmarkList(userId, params)
if (cached) return success(cached)

// 查询数据库
const data = await queryDB(...)

// 写入缓存 (异步)
await bookmarkCache.setBookmarkList(userId, params, data, { async: true })
```

## ⚙️ 配置级别

| 级别 | 说明 | 月成本 | 响应时间 | 命中率 |
|------|------|--------|----------|--------|
| 0 | 无缓存 | ~$5 | 100-300ms | 0% |
| 1 | 最小缓存 ⭐ | ~$8 | 50-100ms | 60-70% |
| 2 | 标准缓存 | ~$12 | 30-50ms | 80-85% |
| 3 | 激进缓存 | ~$20 | 20-30ms | 90-95% |

### Level 0: 无缓存

```typescript
strategies: {
  rateLimit: true,      // 仅速率限制
  publicShare: false,
  defaultList: false,
  tagFilter: false,
  search: false,
  complexQuery: false,
}
```

### Level 1: 最小缓存 (推荐默认)

```typescript
strategies: {
  rateLimit: true,
  publicShare: true,
  defaultList: true,    // 缓存默认列表
  tagFilter: false,
  search: false,
  complexQuery: false,
}
```

### Level 2: 标准缓存 (推荐生产)

```typescript
strategies: {
  rateLimit: true,
  publicShare: true,
  defaultList: true,
  tagFilter: true,      // 缓存标签筛选
  search: false,
  complexQuery: false,
}
memoryCache: {
  enabled: true,        // 启用内存缓存
  maxAge: 60,
}
```

### Level 3: 激进缓存

```typescript
strategies: {
  rateLimit: true,
  publicShare: true,
  defaultList: true,
  tagFilter: true,
  search: true,         // 缓存搜索
  complexQuery: true,   // 缓存复杂查询
}
```

## 🔧 API 参考

### CacheService

核心缓存服务类。

```typescript
class CacheService {
  // 获取缓存
  async get<T>(type: CacheStrategyType, key: string): Promise<T | null>
  
  // 设置缓存
  async set<T>(type: CacheStrategyType, key: string, data: T, options?: CacheSetOptions): Promise<void>
  
  // 删除缓存
  async delete(key: string): Promise<void>
  
  // 批量删除 (按前缀)
  async invalidate(prefix: string): Promise<void>
  
  // 判断是否应该缓存
  shouldCache(type: CacheStrategyType, params?: any): boolean
  
  // 获取统计信息
  getStats(): CacheStats
  
  // 获取配置
  getConfig(): CacheConfig
}
```

### BookmarkCacheManager

书签缓存管理器。

```typescript
class BookmarkCacheManager {
  // 获取书签列表缓存
  async getBookmarkList<T>(userId: string, params?: QueryParams): Promise<T | null>
  
  // 设置书签列表缓存
  async setBookmarkList<T>(userId: string, params: QueryParams | undefined, data: T, options?: { async?: boolean }): Promise<void>
  
  // 失效用户的所有书签缓存
  async invalidateUserBookmarks(userId: string): Promise<void>
  
  // 失效特定查询的缓存
  async invalidateQuery(userId: string, params?: QueryParams): Promise<void>
  
  // 批量操作后的缓存处理
  async handleBatchOperation(userId: string): Promise<void>
}
```

### 工具函数

```typescript
// 生成缓存键
generateCacheKey(type: CacheStrategyType, userId: string, params?: QueryParams): string

// 判断查询类型
getQueryType(params?: QueryParams): CacheStrategyType

// 判断是否应该缓存
shouldCacheQuery(type: CacheStrategyType, params?: QueryParams): boolean

// 获取失效前缀
getCacheInvalidationPrefix(userId: string, type?: CacheStrategyType): string
```

## 💡 最佳实践

### 1. 使用异步写入

```typescript
// ✅ 推荐：异步写入，不阻塞主流程
await cache.set('defaultList', key, data, { async: true })

// ❌ 避免：同步写入，阻塞响应
await cache.set('defaultList', key, data)
```

### 2. 批量操作不写缓存

```typescript
// ✅ 推荐：批量导入后只失效缓存
await bookmarkCache.handleBatchOperation(userId)

// ❌ 避免：批量导入时逐个写缓存
for (const bookmark of bookmarks) {
  await cache.set(...)  // 不要这样做
}
```

### 3. 使用缓存管理器

```typescript
// ✅ 推荐：使用封装好的管理器
const bookmarkCache = createBookmarkCacheManager(cache)
await bookmarkCache.getBookmarkList(userId, params)

// ❌ 避免：直接操作缓存服务
await cache.get('defaultList', `bookmarks:${userId}:...`)
```

### 4. 检查缓存命中率

```typescript
const stats = cache.getStats()
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`)

// 如果命中率 < 60%，考虑调整策略
```

## 🛡️ 容错机制

### 1. 自动降级

```typescript
// KV 不可用时自动降级到 D1
const cached = await cache.get('defaultList', key)
// 如果 KV 失败，返回 null，触发 D1 查询
```

### 2. 超时保护

```typescript
// 100ms 超时，避免缓存拖慢响应
private readonly CACHE_TIMEOUT = 100
```

### 3. 错误计数

```typescript
// 错误过多时自动禁用缓存
private readonly MAX_ERRORS = 10
```

## 📊 监控

### 获取统计信息

```typescript
const stats = cache.getStats()

console.log({
  level: stats.level,           // 缓存级别
  enabled: stats.enabled,       // 是否启用
  hits: stats.hits,             // 命中次数
  misses: stats.misses,         // 未命中次数
  hitRate: stats.hitRate,       // 命中率
  memCacheSize: stats.memCacheSize,  // 内存缓存大小
})
```

### 调试模式

```toml
# wrangler.toml
[vars]
CACHE_DEBUG = "true"
```

## 🔄 迁移

参见 [迁移指南](../../../docs/cache-migration-guide.md)

## 📚 相关文档

- [强健缓存策略](../../../docs/robust-cache-strategy.md)
- [KV 优化分析](../../../docs/kv-optimization-analysis.md)
- [存储架构分析](../../../docs/storage-cache-cloudflare-analysis.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License
