# Design Document: TMarks Dokploy Migration

## Overview

本设计文档描述将 TMarks 从 Cloudflare 生态系统迁移到自托管 Dokploy 部署的技术方案。迁移涉及四个核心组件的替换：数据库 (D1 → PostgreSQL)、API 层 (Pages Functions → Next.js API Routes)、缓存 (KV → Redis)、文件存储 (R2 → MinIO/本地文件系统)。

## Architecture

### 当前架构 (Cloudflare)

```mermaid
graph TB
    subgraph "Cloudflare Edge"
        CF_Pages[Cloudflare Pages<br/>静态前端]
        CF_Functions[Pages Functions<br/>API 后端]
        CF_D1[(D1 Database<br/>SQLite)]
        CF_KV[(KV Store<br/>缓存)]
        CF_R2[(R2 Bucket<br/>文件存储)]
    end
    
    Client[浏览器/扩展] --> CF_Pages
    CF_Pages --> CF_Functions
    CF_Functions --> CF_D1
    CF_Functions --> CF_KV
    CF_Functions --> CF_R2
```

### 目标架构 (Dokploy Self-Hosted)

```mermaid
graph TB
    subgraph "Docker Compose Stack"
        NextJS[Next.js App<br/>前端 + API Routes]
        PostgreSQL[(PostgreSQL<br/>数据库)]
        Redis[(Redis<br/>缓存)]
        MinIO[(MinIO<br/>文件存储)]
    end
    
    subgraph "Reverse Proxy"
        Traefik[Traefik/Nginx<br/>SSL + 路由]
    end
    
    Client[浏览器/扩展] --> Traefik
    Traefik --> NextJS
    NextJS --> PostgreSQL
    NextJS --> Redis
    NextJS --> MinIO
```

## Components and Interfaces

### 1. 数据库层 (Database Layer)

#### 技术选型
- **ORM**: Drizzle ORM (TypeScript-first, 轻量级)
- **数据库**: PostgreSQL 16
- **迁移工具**: Drizzle Kit

#### 接口设计

```typescript
// src/lib/db/schema.ts - Drizzle Schema 定义
import { pgTable, text, timestamp, boolean, integer, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  publicShareEnabled: boolean('public_share_enabled').notNull().default(false),
  publicSlug: text('public_slug'),
  publicPageTitle: text('public_page_title'),
  publicPageDescription: text('public_page_description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  lastClickedAt: timestamp('last_clicked_at'),
  hasSnapshot: boolean('has_snapshot').notNull().default(false),
  latestSnapshotAt: timestamp('latest_snapshot_at'),
  snapshotCount: integer('snapshot_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// ... 其他表定义
```

```typescript
// src/lib/db/index.ts - 数据库连接
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
```

### 2. API 层 (API Layer)

#### 路由映射

| 原 Pages Functions 路径 | 新 Next.js API Routes 路径 |
|------------------------|---------------------------|
| `/api/v1/auth/login` | `/api/v1/auth/login` |
| `/api/v1/bookmarks/[id]` | `/api/v1/bookmarks/[id]` |
| `/api/v1/tags/[id]` | `/api/v1/tags/[id]` |
| `/api/tab-groups/[id]` | `/api/tab-groups/[id]` |

#### 中间件适配

```typescript
// src/lib/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

export interface AuthContext {
  userId: string;
  sessionId?: string;
}

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const token = extractJWT(request);
  
  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
      { status: 401 }
    );
  }

  try {
    const payload = await verifyJWT(token, process.env.JWT_SECRET!);
    return handler(request, { userId: payload.sub, sessionId: payload.session_id });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
      { status: 401 }
    );
  }
}

function extractJWT(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
```

#### API Route 示例

```typescript
// src/app/api/v1/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, authTokens, auditLogs } from '@/lib/db/schema';
import { eq, or, sql } from 'drizzle-orm';
import { verifyPassword, generateToken, hashRefreshToken } from '@/lib/crypto';
import { generateJWT, parseExpiry } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Username and password are required' } },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await db.query.users.findFirst({
      where: or(
        sql`LOWER(${users.username}) = LOWER(${body.username})`,
        sql`LOWER(${users.email}) = LOWER(${body.username})`
      ),
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' } },
        { status: 401 }
      );
    }

    // 生成 tokens
    const sessionId = crypto.randomUUID();
    const accessToken = await generateJWT(
      { sub: user.id, session_id: sessionId },
      process.env.JWT_SECRET!,
      process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '365d'
    );

    const refreshToken = generateToken(32);
    const refreshTokenHash = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + parseExpiry(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '365d') * 1000);

    // 存储 refresh token
    await db.insert(authTokens).values({
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    });

    return NextResponse.json({
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Login failed' } },
      { status: 500 }
    );
  }
}
```

### 3. 缓存层 (Cache Layer)

#### 接口设计

```typescript
// src/lib/cache/service.ts
import { Redis } from 'ioredis';

export type CacheStrategyType = 'defaultList' | 'tagFilter' | 'search' | 'publicShare';

export class CacheService {
  private redis: Redis | null;
  private memCache: Map<string, { data: unknown; expires: number }> = new Map();
  private config: CacheConfig;

  constructor() {
    this.config = loadCacheConfig();
    
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    } else {
      this.redis = null;
      console.warn('Redis not configured, using memory cache only');
    }
  }

  async get<T>(type: CacheStrategyType, key: string): Promise<T | null> {
    if (!this.isEnabled(type)) return null;

    // L1: Memory cache
    const memCached = this.getFromMemory<T>(key);
    if (memCached !== null) return memCached;

    // L2: Redis cache
    if (this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          const parsed = JSON.parse(data) as T;
          this.setToMemory(key, parsed);
          return parsed;
        }
      } catch (error) {
        console.warn('Redis get error:', error);
      }
    }

    return null;
  }

  async set<T>(type: CacheStrategyType, key: string, data: T, ttl?: number): Promise<void> {
    if (!this.isEnabled(type)) return;

    const effectiveTtl = ttl || this.config.ttl[type] || 600;

    // L1: Memory cache
    this.setToMemory(key, data);

    // L2: Redis cache
    if (this.redis) {
      try {
        await this.redis.setex(key, effectiveTtl, JSON.stringify(data));
      } catch (error) {
        console.warn('Redis set error:', error);
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.memCache.delete(key);
    if (this.redis) {
      await this.redis.del(key);
    }
  }

  async invalidate(prefix: string): Promise<void> {
    // Clear memory cache
    for (const key of this.memCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memCache.delete(key);
      }
    }

    // Clear Redis cache
    if (this.redis) {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memCache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data as T;
    }
    if (entry) this.memCache.delete(key);
    return null;
  }

  private setToMemory<T>(key: string, data: T): void {
    this.memCache.set(key, {
      data,
      expires: Date.now() + (this.config.memoryCache.maxAge * 1000),
    });
  }

  private isEnabled(type: CacheStrategyType): boolean {
    return this.config.enabled && this.config.strategies[type];
  }
}

export const cacheService = new CacheService();
```

### 4. 文件存储层 (Storage Layer)

#### 接口设计

```typescript
// src/lib/storage/interface.ts
export interface StorageProvider {
  upload(key: string, data: Buffer | ArrayBuffer, options?: UploadOptions): Promise<UploadResult>;
  download(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}
```

```typescript
// src/lib/storage/minio.ts
import { Client } from 'minio';
import { StorageProvider, UploadOptions, UploadResult } from './interface';

export class MinioStorage implements StorageProvider {
  private client: Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
    this.bucket = process.env.MINIO_BUCKET || 'tmarks';
    this.publicUrl = process.env.STORAGE_PUBLIC_URL || '';
  }

  async upload(key: string, data: Buffer | ArrayBuffer, options?: UploadOptions): Promise<UploadResult> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': options?.contentType || 'application/octet-stream',
      ...options?.metadata,
    });

    return {
      key,
      url: `${this.publicUrl}/${key}`,
      size: buffer.length,
    };
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      const stream = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresIn);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// src/lib/storage/local.ts
import fs from 'fs/promises';
import path from 'path';
import { StorageProvider, UploadOptions, UploadResult } from './interface';

export class LocalStorage implements StorageProvider {
  private basePath: string;
  private publicUrl: string;

  constructor() {
    this.basePath = process.env.STORAGE_PATH || './storage';
    this.publicUrl = process.env.STORAGE_PUBLIC_URL || '/storage';
  }

  async upload(key: string, data: Buffer | ArrayBuffer, options?: UploadOptions): Promise<UploadResult> {
    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await fs.writeFile(filePath, buffer);

    return {
      key,
      url: `${this.publicUrl}/${key}`,
      size: buffer.length,
    };
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.basePath, key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.basePath, key));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local storage doesn't support signed URLs, return direct path
    return `${this.publicUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.basePath, key));
      return true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// src/lib/storage/index.ts
import { StorageProvider } from './interface';
import { MinioStorage } from './minio';
import { LocalStorage } from './local';

export function createStorageProvider(): StorageProvider {
  if (process.env.MINIO_ENDPOINT) {
    return new MinioStorage();
  }
  return new LocalStorage();
}

export const storage = createStorageProvider();
```

## Data Models

### 环境变量配置

```env
# Database
DATABASE_URL=postgresql://tmarks:password@postgres:5432/tmarks

# Redis (可选)
REDIS_URL=redis://redis:6379

# MinIO Storage (可选，不配置则使用本地存储)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=tmarks

# 本地存储路径 (当不使用 MinIO 时)
STORAGE_PATH=/app/storage
STORAGE_PUBLIC_URL=/storage

# JWT
JWT_SECRET=your-long-random-jwt-secret-at-least-48-characters
JWT_ACCESS_TOKEN_EXPIRES_IN=365d
JWT_REFRESH_TOKEN_EXPIRES_IN=365d

# App
ALLOW_REGISTRATION=true
ENVIRONMENT=production
```

### Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://tmarks:password@postgres:5432/tmarks
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - MINIO_BUCKET=tmarks
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
      - minio
    volumes:
      - storage:/app/storage

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=tmarks
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=tmarks
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9001:9001"

volumes:
  postgres_data:
  redis_data:
  minio_data:
  storage:
```

### Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable pnpm && pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the acceptance criteria analysis, the following correctness properties must be validated:

### Property 1: Database Entity Serialization Round-Trip

*For any* valid database entity (User, Bookmark, Tag, TabGroup, etc.), serializing to JSON and deserializing back SHALL produce an equivalent entity object with all fields preserved.

**Validates: Requirements 1.4, 6.2**

### Property 2: JWT Validation Correctness

*For any* JWT token, the authentication middleware SHALL accept tokens signed with the correct secret and reject tokens that are expired, malformed, or signed with incorrect secrets.

**Validates: Requirements 2.2**

### Property 3: API Error Response Format

*For any* API error condition, the response SHALL contain a JSON object with `error.code` (string) and `error.message` (string) fields, and the HTTP status code SHALL match the error type.

**Validates: Requirements 2.3**

### Property 4: API Response Compatibility

*For any* API endpoint, the response structure (field names, types, nesting) SHALL match the original Cloudflare Pages Functions implementation.

**Validates: Requirements 2.4**

### Property 5: Cache Round-Trip

*For any* cacheable data and cache key, storing data in the cache and immediately retrieving it SHALL return the same data. After TTL expiration, retrieval SHALL return null.

**Validates: Requirements 3.1, 3.2**

### Property 6: Cache Invalidation by Prefix

*For any* set of cache keys sharing a common prefix, calling invalidate with that prefix SHALL remove all matching keys and leave non-matching keys unchanged.

**Validates: Requirements 3.4**

### Property 7: Storage Round-Trip

*For any* file content and storage key, uploading to storage and downloading SHALL return identical content. The returned URL SHALL be accessible.

**Validates: Requirements 4.1, 4.2**

### Property 8: Bookmark Deletion Cascades to Files

*For any* bookmark with associated images or snapshots, deleting the bookmark SHALL remove all associated files from storage (unless shared by other bookmarks via content hash).

**Validates: Requirements 4.3**

## Error Handling

### Database Errors

```typescript
// src/lib/errors.ts
export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### API Error Handler

```typescript
// src/lib/api/error-handler.ts
import { NextResponse } from 'next/server';
import { NotFoundError, ValidationError, DatabaseError } from '@/lib/errors';

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: error.message, fields: error.fields } },
      { status: 400 }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: error.message } },
      { status: 404 }
    );
  }

  if (error instanceof DatabaseError) {
    return NextResponse.json(
      { error: { code: 'DATABASE_ERROR', message: 'Database operation failed' } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 }
  );
}
```

### Graceful Degradation

- **Redis 不可用**: 自动降级到内存缓存，记录警告日志
- **MinIO 不可用**: 返回明确错误，不影响核心书签功能
- **数据库连接失败**: 返回 503 Service Unavailable，触发健康检查失败

## Testing Strategy

### Property-Based Testing

使用 **fast-check** 库进行属性测试，验证核心正确性属性。

```typescript
// src/__tests__/properties/serialization.test.ts
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

// **Feature: dokploy-migration, Property 1: Database Entity Serialization Round-Trip**
describe('Property 1: Database Entity Serialization Round-Trip', () => {
  it('should preserve all fields when serializing and deserializing User entity', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          username: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.option(fc.emailAddress()),
          role: fc.constantFrom('user', 'admin'),
          createdAt: fc.date(),
          updatedAt: fc.date(),
        }),
        (user) => {
          const serialized = JSON.stringify(user);
          const deserialized = JSON.parse(serialized);
          
          expect(deserialized.id).toBe(user.id);
          expect(deserialized.username).toBe(user.username);
          expect(deserialized.email).toBe(user.email);
          expect(deserialized.role).toBe(user.role);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing

使用 **Vitest** 进行单元测试，覆盖关键功能点。

```typescript
// src/__tests__/unit/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { verifyJWT, generateJWT } from '@/lib/jwt';

describe('JWT Authentication', () => {
  const secret = 'test-secret-at-least-32-characters-long';

  it('should generate and verify valid JWT', async () => {
    const payload = { sub: 'user-123', session_id: 'session-456' };
    const token = await generateJWT(payload, secret, '1h');
    const verified = await verifyJWT(token, secret);
    
    expect(verified.sub).toBe(payload.sub);
    expect(verified.session_id).toBe(payload.session_id);
  });

  it('should reject expired JWT', async () => {
    const payload = { sub: 'user-123' };
    const token = await generateJWT(payload, secret, '0s');
    
    await expect(verifyJWT(token, secret)).rejects.toThrow();
  });

  it('should reject JWT with wrong secret', async () => {
    const payload = { sub: 'user-123' };
    const token = await generateJWT(payload, secret, '1h');
    
    await expect(verifyJWT(token, 'wrong-secret')).rejects.toThrow();
  });
});
```

### Integration Testing

使用 **Playwright** 或 **Vitest** 进行集成测试，验证 API 端点。

```typescript
// src/__tests__/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '@/test-utils/server';

describe('API Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return 401 for unauthenticated requests', async () => {
    const response = await server.fetch('/api/v1/bookmarks');
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return bookmarks for authenticated user', async () => {
    const token = await server.createTestUser();
    const response = await server.fetch('/api/v1/bookmarks', {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
  });
});
```

### 测试配置

- **Property-based tests**: 每个属性至少运行 100 次迭代
- **Unit tests**: 覆盖所有公共函数和边界条件
- **Integration tests**: 覆盖所有 API 端点的成功和错误路径
- **测试框架**: Vitest + fast-check
- **测试标注**: 每个属性测试必须注明对应的 Property 编号和 Requirements 引用
