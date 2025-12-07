# Implementation Plan

## Phase 1: 项目基础设施

- [x] 1. 配置 Next.js 为 SSR 模式并设置项目结构
  - [x] 1.1 修改 next.config.mjs，移除 `output: 'export'`，启用 standalone 输出
    - 添加 `output: 'standalone'` 配置
    - 保留现有的 modularizeImports 和 experimental 配置
    - _Requirements: 5.1_
  - [x] 1.2 创建 src/lib/db 目录结构和 Drizzle 配置
    - 安装 drizzle-orm, @neondatabase/serverless 或 pg
    - 创建 drizzle.config.ts
    - _Requirements: 1.1, 1.2_
  - [x] 1.3 创建数据库 schema 定义文件
    - 将 SQLite schema 转换为 PostgreSQL Drizzle schema
    - 包含所有表: users, bookmarks, tags, bookmark_tags, tab_groups, tab_group_items 等
    - _Requirements: 1.2, 1.3_
  - [x]* 1.4 Write property test for database entity serialization
    - **Property 1: Database Entity Serialization Round-Trip**
    - **Validates: Requirements 1.4, 6.2**

- [x] 2. Checkpoint - 确保数据库 schema 正确
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: 核心库迁移

- [x] 3. 迁移认证和加密库
  - [x] 3.1 创建 src/lib/jwt.ts (从 functions/lib/jwt.ts 迁移)
    - 使用 jose 库替代 Cloudflare Workers 的 crypto API
    - 保持 generateJWT, verifyJWT, extractJWT 接口不变
    - _Requirements: 2.2_
  - [x] 3.2 创建 src/lib/crypto.ts (从 functions/lib/crypto.ts 迁移)
    - 使用 Node.js crypto 模块
    - 保持 hashPassword, verifyPassword, generateToken 接口不变
    - _Requirements: 2.2_
  - [x]* 3.3 Write property test for JWT validation
    - **Property 2: JWT Validation Correctness**
    - **Validates: Requirements 2.2**

- [x] 4. 迁移缓存服务
  - [x] 4.1 创建 src/lib/cache/service.ts
    - 使用 ioredis 替代 Cloudflare KV
    - 实现内存缓存 + Redis 双层架构
    - 支持 Redis 不可用时的优雅降级
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 4.2 创建 src/lib/cache/config.ts 和 types.ts
    - 从环境变量加载缓存配置
    - 定义 CacheStrategyType 和 CacheConfig 类型
    - _Requirements: 3.1_
  - [x]* 4.3 Write property test for cache round-trip
    - **Property 5: Cache Round-Trip**
    - **Validates: Requirements 3.1, 3.2**
  - [x]* 4.4 Write property test for cache invalidation
    - **Property 6: Cache Invalidation by Prefix**
    - **Validates: Requirements 3.4**

- [x] 5. 迁移存储服务
  - [x] 5.1 创建 src/lib/storage/interface.ts
    - 定义 StorageProvider 接口
    - 定义 UploadOptions, UploadResult 类型
    - _Requirements: 4.1, 4.2_
  - [x] 5.2 创建 src/lib/storage/minio.ts
    - 使用 minio 库实现 MinioStorage 类
    - 实现 upload, download, delete, getSignedUrl, exists 方法
    - _Requirements: 4.1, 4.2_
  - [x] 5.3 创建 src/lib/storage/local.ts
    - 使用 Node.js fs 模块实现 LocalStorage 类
    - 作为 MinIO 不可用时的备选方案
    - _Requirements: 4.1, 4.2_
  - [x] 5.4 创建 src/lib/storage/index.ts
    - 根据环境变量选择存储提供者
    - 导出 storage 单例
    - _Requirements: 4.1_
  - [x]* 5.5 Write property test for storage round-trip
    - **Property 7: Storage Round-Trip**
    - **Validates: Requirements 4.1, 4.2**

- [x] 6. Checkpoint - 确保核心库工作正常
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: API 路由迁移

- [x] 7. 创建 API 中间件和工具函数
  - [x] 7.1 创建 src/lib/api/middleware/auth.ts
    - 实现 withAuth 高阶函数
    - 实现 optionalAuth 高阶函数
    - _Requirements: 2.2_
  - [x] 7.2 创建 src/lib/api/response.ts
    - 实现 success, badRequest, unauthorized, notFound, internalError 响应函数
    - 保持与原有响应格式兼容
    - _Requirements: 2.3_
  - [x] 7.3 创建 src/lib/api/error-handler.ts
    - 实现统一错误处理函数
    - 支持 ValidationError, NotFoundError, DatabaseError
    - _Requirements: 2.3_
  - [x]* 7.4 Write property test for API error response format
    - **Property 3: API Error Response Format**
    - **Validates: Requirements 2.3**

- [x] 8. 迁移认证 API
  - [x] 8.1 创建 src/app/api/v1/auth/login/route.ts
    - 从 functions/api/v1/auth/login.ts 迁移
    - 使用 Drizzle ORM 查询用户
    - _Requirements: 2.1, 2.4_
  - [x] 8.2 创建 src/app/api/v1/auth/register/route.ts
    - 从 functions/api/v1/auth/register.ts 迁移
    - _Requirements: 2.1, 2.4_
  - [x] 8.3 创建 src/app/api/v1/auth/refresh/route.ts
    - 从 functions/api/v1/auth/refresh.ts 迁移
    - _Requirements: 2.1, 2.4_
  - [x] 8.4 创建 src/app/api/v1/auth/logout/route.ts
    - 从 functions/api/v1/auth/logout.ts 迁移
    - _Requirements: 2.1, 2.4_

- [x] 9. 迁移书签 API
  - [x] 9.1 创建 src/app/api/v1/bookmarks/route.ts (GET, POST)
    - 列表查询和创建书签
    - 支持分页、排序、筛选
    - _Requirements: 2.1, 2.4_
  - [x] 9.2 创建 src/app/api/v1/bookmarks/[id]/route.ts (GET, PATCH, DELETE)
    - 单个书签的 CRUD 操作
    - _Requirements: 2.1, 2.4_
  - [x] 9.3 创建 src/app/api/v1/bookmarks/[id]/click/route.ts
    - 记录书签点击
    - _Requirements: 2.1, 2.4_
  - [x]* 9.4 Write property test for bookmark deletion cascade
    - **Property 8: Bookmark Deletion Cascades to Files**
    - **Validates: Requirements 4.3**

- [x] 10. 迁移标签 API
  - [x] 10.1 创建 src/app/api/v1/tags/route.ts (GET, POST)
    - 标签列表和创建
    - _Requirements: 2.1, 2.4_
  - [x] 10.2 创建 src/app/api/v1/tags/[id]/route.ts (GET, PATCH, DELETE)
    - 单个标签的 CRUD 操作
    - _Requirements: 2.1, 2.4_

- [x] 11. 迁移标签页组 API (OneTab 功能)
  - [x] 11.1 创建 src/app/api/tab-groups/route.ts (GET, POST)
    - 标签页组列表和创建
    - _Requirements: 2.1, 2.4_
  - [x] 11.2 创建 src/app/api/tab-groups/[id]/route.ts (GET, PATCH, DELETE)
    - 单个标签页组的 CRUD 操作
    - _Requirements: 2.1, 2.4_
  - [x] 11.3 创建 src/app/api/tab-groups/items/route.ts
    - 标签页项的批量操作
    - _Requirements: 2.1, 2.4_

- [x] 12. 迁移其他 API
  - [x] 12.1 创建 src/app/api/v1/health/route.ts
    - 健康检查端点，检查数据库、Redis、存储连接
    - _Requirements: 5.4_
  - [x] 12.2 创建 src/app/api/me/route.ts
    - 当前用户信息
    - _Requirements: 2.1, 2.4_
  - [x] 12.3 创建 src/app/api/search/route.ts
    - 全局搜索
    - _Requirements: 2.1, 2.4_
  - [x] 12.4 创建 src/app/api/v1/export/route.ts 和 import/route.ts
    - 数据导入导出
    - _Requirements: 2.1, 2.4, 6.1, 6.2_
  - [x]* 12.5 Write property test for API response compatibility
    - **Property 4: API Response Compatibility**
    - **Validates: Requirements 2.4**

- [x] 13. Checkpoint - 确保所有 API 工作正常
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: 部署配置

- [x] 14. 创建 Docker 配置
  - [x] 14.1 创建 Dockerfile
    - 多阶段构建: deps → builder → runner
    - 使用 standalone 输出模式
    - _Requirements: 5.1_
  - [x] 14.2 创建 docker-compose.yml
    - 包含 app, postgres, redis, minio 服务
    - 配置 volumes 持久化数据
    - _Requirements: 5.1, 7.1_
  - [x] 14.3 创建 docker-compose.dev.yml
    - 开发环境配置，支持热重载
    - 挂载源代码目录
    - _Requirements: 7.1, 7.2_
  - [x] 14.4 创建 .env.example 和环境变量文档
    - 列出所有必需和可选的环境变量
    - _Requirements: 5.2_

- [x] 15. 创建数据迁移工具
  - [x] 15.1 创建 scripts/migrate-from-d1.ts
    - 从 D1 导出数据为 JSON
    - 支持增量导出
    - _Requirements: 6.1_
  - [x] 15.2 创建 scripts/import-to-postgres.ts
    - 将 JSON 数据导入 PostgreSQL
    - 支持冲突处理选项
    - 输出迁移统计报告
    - _Requirements: 6.2, 6.3, 6.4_

- [x] 16. 创建部署脚本和文档
  - [x] 16.1 创建 scripts/setup.sh
    - 初始化数据库
    - 创建 MinIO bucket
    - 运行数据库迁移
    - _Requirements: 5.3_
  - [x] 16.2 更新 README.md
    - 添加 Dokploy 部署说明
    - 添加环境变量配置说明
    - 添加数据迁移步骤
    - _Requirements: 5.1, 5.2_

- [x] 17. Final Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.
