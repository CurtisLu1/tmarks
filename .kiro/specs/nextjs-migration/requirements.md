# Requirements Document

## Introduction

本文档定义了将 tmarks 项目从当前的 Vite + React + React Router 技术栈迁移到 Next.js + Tailwind CSS + shadcn/ui 技术栈的需求规范。tmarks 是一个书签管理应用，包含前端 Web 应用和 Cloudflare Workers 后端 API。本次迁移主要针对前端部分，保持后端 API 不变。

## Glossary

- **tmarks**: 书签管理应用系统
- **Next.js**: React 全栈框架，支持服务端渲染(SSR)、静态生成(SSG)和 App Router
- **shadcn/ui**: 基于 Radix UI 和 Tailwind CSS 的可复用组件库
- **Tailwind CSS**: 实用优先的 CSS 框架
- **App Router**: Next.js 13+ 的新路由系统，基于文件系统的路由
- **Server Components**: Next.js 的服务端组件，默认在服务端渲染
- **Client Components**: 需要客户端交互的 React 组件，使用 'use client' 指令
- **Cloudflare Workers**: 现有后端 API 运行环境
- **Zustand**: 现有状态管理库
- **React Query**: 现有数据获取和缓存库

## Requirements

### Requirement 1: 项目结构迁移

**User Story:** 作为开发者，我希望将项目迁移到 Next.js 标准结构，以便利用 Next.js 的特性和最佳实践。

#### Acceptance Criteria

1. WHEN 初始化新项目 THEN tmarks 系统 SHALL 创建符合 Next.js App Router 规范的目录结构
2. WHEN 配置项目 THEN tmarks 系统 SHALL 保留现有的 TypeScript 配置并适配 Next.js 要求
3. WHEN 设置依赖 THEN tmarks 系统 SHALL 移除 Vite 相关依赖并添加 Next.js 核心依赖
4. WHEN 配置构建 THEN tmarks 系统 SHALL 支持静态导出以便部署到 Cloudflare Pages

### Requirement 2: 路由系统迁移

**User Story:** 作为开发者，我希望将 React Router 路由迁移到 Next.js App Router，以便使用文件系统路由和布局嵌套。

#### Acceptance Criteria

1. WHEN 迁移路由 THEN tmarks 系统 SHALL 将所有现有路由转换为 App Router 文件结构
2. WHEN 处理动态路由 THEN tmarks 系统 SHALL 使用 [param] 语法实现动态路由段
3. WHEN 实现布局 THEN tmarks 系统 SHALL 使用 layout.tsx 文件实现共享布局
42. WHEN 处理受保护路由 THEN tmarks 系统 SHALL 在客户端布局 (Layout) 中实现认证检查（因静态导出不支持中间件）
5. WHEN 处理公开路由 THEN tmarks 系统 SHALL 允许未认证用户访问登录、注册和公开分享页面

### Requirement 3: UI 组件迁移

**User Story:** 作为开发者，我希望使用 shadcn/ui 组件替换现有自定义组件，以便获得一致的设计系统和更好的可维护性。

#### Acceptance Criteria

1. WHEN 初始化 shadcn/ui THEN tmarks 系统 SHALL 配置 shadcn/ui 并安装基础组件
2. WHEN 迁移通用组件 THEN tmarks 系统 SHALL 使用 shadcn/ui 的 Button、Dialog、Toast 等组件替换现有实现
3. WHEN 迁移表单组件 THEN tmarks 系统 SHALL 使用 shadcn/ui 的 Form、Input、Select 等组件
4. WHEN 保留自定义组件 THEN tmarks 系统 SHALL 保留业务特定组件并适配 shadcn/ui 风格
5. WHEN 处理主题 THEN tmarks 系统 SHALL 使用 shadcn/ui 的主题系统支持亮色和暗色模式

### Requirement 4: 状态管理迁移

**User Story:** 作为开发者，我希望保持现有的状态管理方案，同时适配 Next.js 的客户端/服务端组件模型。

#### Acceptance Criteria

1. WHEN 迁移 Zustand store THEN tmarks 系统 SHALL 在客户端组件中使用现有的 Zustand store
2. WHEN 迁移 React Query THEN tmarks 系统 SHALL 配置 React Query Provider 在客户端组件中工作
3. WHEN 处理认证状态 THEN tmarks 系统 SHALL 在客户端维护认证状态并支持 token 刷新
4. WHEN 处理主题状态 THEN tmarks 系统 SHALL 支持系统主题检测和用户主题偏好

### Requirement 5: API 集成

**User Story:** 作为开发者，我希望保持与现有 Cloudflare Workers API 的集成，确保所有功能正常工作。

#### Acceptance Criteria

1. WHEN 配置 API 客户端 THEN tmarks 系统 SHALL 适配现有的 API 客户端以在 Next.js 中工作
2. WHEN 处理环境变量 THEN tmarks 系统 SHALL 使用 Next.js 的环境变量约定 (NEXT_PUBLIC_)
3. WHEN 配置代理 THEN tmarks 系统 SHALL 在开发环境中配置 API 代理或使用 rewrites
4. WHEN 处理认证 THEN tmarks 系统 SHALL 保持现有的 JWT 认证流程

### Requirement 6: 样式系统迁移

**User Story:** 作为开发者，我希望迁移到 shadcn/ui 的样式系统，同时保留现有的自定义样式。

#### Acceptance Criteria

1. WHEN 配置 Tailwind THEN tmarks 系统 SHALL 使用 shadcn/ui 的 Tailwind 配置作为基础
2. WHEN 迁移自定义样式 THEN tmarks 系统 SHALL 将现有的 CSS 变量和主题样式迁移到新系统
3. WHEN 处理组件样式 THEN tmarks 系统 SHALL 使用 Tailwind 类和 cn() 工具函数
4. WHEN 支持响应式 THEN tmarks 系统 SHALL 保持现有的响应式设计和移动端适配

### Requirement 7: 页面功能迁移

**User Story:** 作为用户，我希望迁移后的应用保持所有现有功能，包括书签管理、标签管理、标签页组等。

#### Acceptance Criteria

1. WHEN 迁移书签页面 THEN tmarks 系统 SHALL 保持书签的 CRUD 操作、搜索、筛选和排序功能
2. WHEN 迁移标签页组页面 THEN tmarks 系统 SHALL 保持标签页组的创建、编辑、删除和分享功能
3. WHEN 迁移设置页面 THEN tmarks 系统 SHALL 保持所有用户偏好设置功能
4. WHEN 迁移认证页面 THEN tmarks 系统 SHALL 保持登录、注册和 token 刷新功能
5. WHEN 迁移公开分享页面 THEN tmarks 系统 SHALL 保持公开分享书签的查看功能

### Requirement 8: 构建和部署

**User Story:** 作为开发者，我希望迁移后的项目能够部署到 Cloudflare Pages，与现有后端 API 协同工作。

#### Acceptance Criteria

1. WHEN 配置构建 THEN tmarks 系统 SHALL 支持 Next.js 静态导出 (output: 'export')
2. WHEN 配置部署 THEN tmarks 系统 SHALL 生成与 Cloudflare Pages 兼容的静态文件
3. WHEN 处理路由 THEN tmarks 系统 SHALL 配置 _routes.json 以支持 SPA 路由回退
4. WHEN 优化构建 THEN tmarks 系统 SHALL 保持现有的代码分割和压缩优化

### Requirement 9: 版本安全性

**User Story:** 作为开发者，我希望使用安全稳定的依赖版本，避免已知的安全漏洞。

#### Acceptance Criteria

1. WHEN 选择 React 版本 THEN tmarks 系统 SHALL 使用 React 19.0.1 或更高版本，该版本修复了 CVE-2025-55182（RSC 远程代码执行漏洞，CVSS 10.0）
2. WHEN 选择 Next.js 版本 THEN tmarks 系统 SHALL 使用 Next.js 15.5.7 或更高版本，该版本修复了 CVE-2025-66478（RSC 协议漏洞的下游影响）
3. WHEN 管理依赖 THEN tmarks 系统 SHALL 锁定主要依赖版本，使用精确版本号而非范围版本
4. WHEN 更新依赖 THEN tmarks 系统 SHALL 在更新前检查安全公告和已知问题
5. IF 使用 App Router THEN tmarks 系统 SHALL 确保所有 RSC 相关依赖都已更新到安全版本
6. WHEN 部署应用 THEN tmarks 系统 SHALL 验证不存在已知的高危漏洞
