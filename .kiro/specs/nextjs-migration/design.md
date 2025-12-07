# Design Document: Next.js Migration

## Overview

本设计文档描述将 tmarks 前端应用从 Vite + React Router 技术栈迁移到 Next.js + shadcn/ui 技术栈的详细方案。迁移目标是利用 Next.js 的现代特性（App Router、Server Components）和 shadcn/ui 的组件系统，同时保持与现有 Cloudflare Workers 后端 API 的兼容性。

### 迁移范围

- **包含**: tmarks/src 目录下的前端代码
- **不包含**: tmarks/functions 目录下的后端 API 代码（保持不变）

### 技术栈对比

| 现有技术栈 | 目标技术栈 |
|-----------|-----------|
| Vite 6.0 | Next.js 15.5.7+ |
| React 18.3 | React 19.0.1+ |
| React Router 7.0 | Next.js App Router |
| 自定义组件 | shadcn/ui |
| Tailwind CSS 4.0 alpha | Tailwind CSS 3.4 (shadcn/ui 兼容) |
| Zustand 5.0 | Zustand 5.0 (保持) |
| React Query 5.x | React Query 5.x (保持) |

## Architecture

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   App       │  │   Client    │  │    Server           │  │
│  │   Router    │  │   Components│  │    Components       │  │
│  │   (pages)   │  │   (hooks,   │  │    (layouts,        │  │
│  │             │  │    stores)  │  │     metadata)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    shadcn/ui Components                  ││
│  │  Button | Dialog | Toast | Form | Input | Select | ...  ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Zustand   │  │   React     │  │    API Client       │  │
│  │   Stores    │  │   Query     │  │    (fetch)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers API (不变)                   │
└─────────────────────────────────────────────────────────────┘
```

### 图片策略

由于使用 `output: 'export'`，Next.js 默认的 Image Optimization API 不可用：
- 使用 `unoptimized: true` 配置 `<Image />` 组件
- 或者配置自定义 Loader (e.g. Cloudflare Images)


### 目录结构

```
tmarks/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证相关路由组
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (protected)/              # 受保护路由组
│   │   ├── layout.tsx            # 认证检查布局
│   │   ├── page.tsx              # 书签页面 (/)
│   │   ├── tab/
│   │   │   ├── page.tsx          # 标签页组列表
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx      # 标签页组详情
│   │   │   ├── todo/
│   │   │   │   └── page.tsx
│   │   │   ├── trash/
│   │   │   │   └── page.tsx
│   │   │   └── statistics/
│   │   │       └── page.tsx
│   │   ├── settings/
│   │   │   └── general/
│   │   │       └── page.tsx
│   │   ├── api-keys/
│   │   │   └── page.tsx
│   │   ├── share-settings/
│   │   │   └── page.tsx
│   │   ├── import-export/
│   │   │   └── page.tsx
│   │   └── ...
│   ├── share/
│   │   └── [slug]/
│   │       └── page.tsx          # 公开分享页面
│   ├── layout.tsx                # 根布局
│   ├── globals.css               # 全局样式
│   └── providers.tsx             # 客户端 Providers
├── components/
│   ├── ui/                       # shadcn/ui 组件
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   ├── bookmarks/                # 书签相关组件
│   ├── tab-groups/               # 标签页组组件
│   ├── tags/                     # 标签组件
│   ├── settings/                 # 设置组件
│   ├── auth/                     # 认证组件
│   └── layout/                   # 布局组件
├── hooks/                        # 自定义 Hooks
├── lib/
│   ├── api-client.ts             # API 客户端
│   ├── utils.ts                  # 工具函数 (cn)
│   └── types.ts                  # 类型定义
├── stores/                       # Zustand stores
├── services/                     # 服务层
├── next.config.js                # Next.js 配置
├── tailwind.config.js            # Tailwind 配置
├── components.json               # shadcn/ui 配置
└── package.json
```

## Components and Interfaces

### 路由映射

| 现有路由 | Next.js 路由 | 文件路径 |
|---------|-------------|---------|
| `/login` | `/login` | `app/(auth)/login/page.tsx` |
| `/register` | `/register` | `app/(auth)/register/page.tsx` |
| `/` | `/` | `app/(protected)/page.tsx` |
| `/tab` | `/tab` | `app/(protected)/tab/page.tsx` |
| `/tab/:id` | `/tab/[id]` | `app/(protected)/tab/[id]/page.tsx` |
| `/tab/todo` | `/tab/todo` | `app/(protected)/tab/todo/page.tsx` |
| `/tab/trash` | `/tab/trash` | `app/(protected)/tab/trash/page.tsx` |
| `/tab/statistics` | `/tab/statistics` | `app/(protected)/tab/statistics/page.tsx` |
| `/settings/general` | `/settings/general` | `app/(protected)/settings/general/page.tsx` |
| `/api-keys` | `/api-keys` | `app/(protected)/api-keys/page.tsx` |
| `/share-settings` | `/share-settings` | `app/(protected)/share-settings/page.tsx` |
| `/import-export` | `/import-export` | `app/(protected)/import-export/page.tsx` |
| `/share/:slug` | `/share/[slug]` | `app/share/[slug]/page.tsx` |

### shadcn/ui 组件映射

| 现有组件 | shadcn/ui 组件 |
|---------|---------------|
| `Toast` | `@/components/ui/toast` + `useToast` |
| `AlertDialog` | `@/components/ui/alert-dialog` |
| `ConfirmDialog` | `@/components/ui/alert-dialog` |
| `Drawer` | `@/components/ui/sheet` |
| `DropdownMenu` | `@/components/ui/dropdown-menu` |
| `LoadingSpinner` | `@/components/ui/spinner` (自定义) |
| 表单输入 | `@/components/ui/input` |
| 选择器 | `@/components/ui/select` |
| 按钮 | `@/components/ui/button` |

### 客户端/服务端组件划分

**Server Components (默认)**:
- 布局组件 (`layout.tsx`)
- 静态页面内容
- 元数据生成

**Client Components ('use client')**:
- 所有交互式组件
- 使用 hooks 的组件 (useState, useEffect, etc.)
- 使用 Zustand stores 的组件
- 使用 React Query 的组件
- 表单组件
- 主题切换组件

### Providers 结构

```typescript
// app/providers.tsx
'use client'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

## Data Models

数据模型保持不变，继续使用现有的 TypeScript 类型定义：

- `User` - 用户信息
- `Bookmark` - 书签
- `Tag` - 标签
- `TabGroup` - 标签页组
- `TabGroupItem` - 标签页组项目
- `UserPreferences` - 用户偏好设置

### API 客户端适配

```typescript
// lib/api-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

// 保持现有的 HttpClient 类，仅修改环境变量获取方式
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 受保护路由认证检查
*For any* 未认证用户访问受保护路由，系统应重定向到登录页面
**Validates: Requirements 2.4**

### Property 2: 公开路由访问
*For any* 用户（认证或未认证）访问公开路由（/login, /register, /share/[slug]），系统应允许访问而不重定向
**Validates: Requirements 2.5**

### Property 3: 主题切换一致性
*For any* 主题切换操作，系统应在所有组件中一致地应用新主题
**Validates: Requirements 3.5**

### Property 4: Token 刷新流程
*For any* API 请求返回 401 错误，系统应尝试刷新 token 并重试请求
**Validates: Requirements 4.3**

### Property 5: 系统主题检测
*For any* 系统主题设置为 'system'，应用主题应与操作系统主题一致
**Validates: Requirements 4.4**

### Property 6: JWT 认证流程
*For any* 有效的登录凭据，系统应返回有效的 access_token 和 refresh_token
**Validates: Requirements 5.4**

### Property 7: 响应式布局
*For any* 视口宽度，布局应正确适配（移动端/桌面端）
**Validates: Requirements 6.4**

### Property 8: 书签 CRUD 操作
*For any* 书签操作（创建/读取/更新/删除），操作后的数据状态应与预期一致
**Validates: Requirements 7.1**

### Property 9: 标签页组操作
*For any* 标签页组操作（创建/编辑/删除/分享），操作后的数据状态应与预期一致
**Validates: Requirements 7.2**

### Property 10: 设置持久化
*For any* 用户偏好设置更改，设置应正确保存并在刷新后保持
**Validates: Requirements 7.3**

### Property 11: 认证状态持久化
*For any* 成功登录，认证状态应在页面刷新后保持
**Validates: Requirements 7.4**

## Error Handling

### 认证错误处理

```typescript
// 401 错误 -> 尝试刷新 token
// 刷新失败 -> 清除认证状态，重定向到登录页
// 403 错误 -> 显示权限不足提示
```

### API 错误处理

```typescript
// 网络错误 -> 显示网络错误提示，支持重试
// 服务器错误 (5xx) -> 显示服务器错误提示
// 客户端错误 (4xx) -> 显示具体错误信息
```

### 路由错误处理

```typescript
// app/error.tsx - 全局错误边界
// app/not-found.tsx - 404 页面
```

## Testing Strategy

### 单元测试

使用 Vitest 进行单元测试：
- 工具函数测试
- Store 逻辑测试
- API 客户端测试

### 属性测试

使用 fast-check 进行属性测试：
- 认证流程属性测试
- 路由访问控制属性测试
- 数据操作一致性测试

### 集成测试

使用 Playwright 进行端到端测试：
- 完整用户流程测试
- 跨页面导航测试
- 认证流程测试

### 测试配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

### 属性测试示例

```typescript
// tests/auth.property.test.ts
import { fc } from 'fast-check'

// Property 1: 受保护路由认证检查
// **Feature: nextjs-migration, Property 1: 受保护路由认证检查**
test('unauthenticated users are redirected from protected routes', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('/tab', '/settings/general', '/api-keys'),
      (route) => {
        // 未认证用户访问受保护路由应被重定向
        const result = checkRouteAccess(route, { authenticated: false })
        return result.redirectTo === '/login'
      }
    ),
    { numRuns: 100 }
  )
})
```
