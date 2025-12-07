# Requirements Document

## Introduction

本文档定义了将 TMarks 书签管理应用从 Cloudflare 生态系统迁移到自托管 Dokploy 部署的需求。当前应用使用 Cloudflare Pages (静态前端) + Pages Functions (API) + D1 (SQLite) + KV (缓存) + R2 (文件存储) 架构。迁移目标是在保持功能完整性的前提下，使用标准的自托管技术栈替代 Cloudflare 专有服务。

## Glossary

- **TMarks**: 书签管理 Web 应用
- **Dokploy**: 开源的自托管 PaaS 平台，类似 Heroku/Vercel
- **D1**: Cloudflare 的边缘 SQLite 数据库服务
- **KV**: Cloudflare 的键值存储服务
- **R2**: Cloudflare 的 S3 兼容对象存储服务
- **Pages Functions**: Cloudflare Pages 的 serverless 函数服务
- **Next.js API Routes**: Next.js 内置的后端 API 功能
- **PostgreSQL**: 开源关系型数据库
- **Redis**: 开源内存缓存数据库
- **MinIO**: 开源 S3 兼容对象存储
- **Drizzle ORM**: TypeScript-first 的 ORM 库

## Requirements

### Requirement 1: 数据库迁移

**User Story:** 作为开发者，我希望将数据库从 Cloudflare D1 迁移到 PostgreSQL，以便在自托管环境中运行应用。

#### Acceptance Criteria

1. WHEN 应用启动时 THEN TMarks 系统 SHALL 连接到 PostgreSQL 数据库并验证连接成功
2. WHEN 执行数据库查询时 THEN TMarks 系统 SHALL 使用 Drizzle ORM 执行类型安全的数据库操作
3. WHEN 数据库 schema 需要更新时 THEN TMarks 系统 SHALL 通过 Drizzle 迁移机制应用变更
4. WHEN 序列化数据库实体到 JSON 时 THEN TMarks 系统 SHALL 能够反序列化回等价的实体对象

### Requirement 2: API 层迁移

**User Story:** 作为开发者，我希望将 Cloudflare Pages Functions 迁移到 Next.js API Routes，以便使用标准的 Node.js 运行时。

#### Acceptance Criteria

1. WHEN 客户端发送 API 请求时 THEN TMarks 系统 SHALL 通过 Next.js API Routes 处理请求并返回响应
2. WHEN API 路由需要认证时 THEN TMarks 系统 SHALL 验证 JWT token 并拒绝无效请求
3. WHEN API 处理过程中发生错误时 THEN TMarks 系统 SHALL 返回标准化的错误响应格式
4. WHILE 处理 API 请求时 THEN TMarks 系统 SHALL 保持与原有 API 接口的兼容性

### Requirement 3: 缓存系统迁移

**User Story:** 作为开发者，我希望将 Cloudflare KV 缓存迁移到 Redis，以便在自托管环境中提供高性能缓存。

#### Acceptance Criteria

1. WHEN 缓存数据时 THEN TMarks 系统 SHALL 将数据存储到 Redis 并设置过期时间
2. WHEN 读取缓存时 THEN TMarks 系统 SHALL 从 Redis 获取数据或返回缓存未命中
3. IF Redis 连接失败 THEN TMarks 系统 SHALL 优雅降级并直接查询数据库
4. WHEN 缓存需要失效时 THEN TMarks 系统 SHALL 按前缀批量删除相关缓存键

### Requirement 4: 文件存储迁移

**User Story:** 作为开发者，我希望将 Cloudflare R2 迁移到 MinIO 或本地文件系统，以便在自托管环境中存储书签快照和图片。

#### Acceptance Criteria

1. WHEN 上传文件时 THEN TMarks 系统 SHALL 将文件存储到 MinIO 或本地文件系统
2. WHEN 请求文件时 THEN TMarks 系统 SHALL 返回文件内容或生成签名 URL
3. WHEN 删除书签时 THEN TMarks 系统 SHALL 清理关联的快照和图片文件
4. IF 存储服务不可用 THEN TMarks 系统 SHALL 返回明确的错误信息

### Requirement 5: 部署配置

**User Story:** 作为运维人员，我希望通过 Dokploy 一键部署整个应用栈，以便简化部署和运维流程。

#### Acceptance Criteria

1. WHEN 执行部署时 THEN Dokploy 系统 SHALL 构建并启动 Next.js 应用容器
2. WHEN 配置环境变量时 THEN TMarks 系统 SHALL 从环境变量读取数据库连接、JWT 密钥等配置
3. WHEN 应用启动时 THEN TMarks 系统 SHALL 自动执行数据库迁移
4. WHEN 健康检查请求到达时 THEN TMarks 系统 SHALL 返回应用和依赖服务的健康状态

### Requirement 6: 数据迁移工具

**User Story:** 作为用户，我希望能够将现有 Cloudflare D1 中的数据迁移到新的 PostgreSQL 数据库，以便保留所有书签和设置。

#### Acceptance Criteria

1. WHEN 执行数据导出时 THEN 迁移工具 SHALL 从 D1 导出所有用户数据为 JSON 格式
2. WHEN 执行数据导入时 THEN 迁移工具 SHALL 将 JSON 数据导入到 PostgreSQL 并保持数据完整性
3. WHEN 导入过程中遇到冲突时 THEN 迁移工具 SHALL 提供跳过或覆盖选项
4. WHEN 迁移完成时 THEN 迁移工具 SHALL 输出迁移统计报告

### Requirement 7: 开发环境支持

**User Story:** 作为开发者，我希望能够在本地使用 Docker Compose 运行完整的开发环境，以便进行开发和测试。

#### Acceptance Criteria

1. WHEN 执行 docker-compose up 时 THEN 开发环境 SHALL 启动 Next.js、PostgreSQL、Redis 和 MinIO 服务
2. WHEN 修改代码时 THEN 开发环境 SHALL 支持热重载
3. WHEN 需要重置数据库时 THEN 开发环境 SHALL 提供便捷的重置命令
4. WHEN 查看日志时 THEN 开发环境 SHALL 聚合显示所有服务的日志
