# Implementation Plan

## Phase 1: 项目初始化

- [x] 1. 初始化 Next.js 项目
  - [x] 1.1 创建新的 Next.js 项目结构
    - 在 tmarks 目录下初始化 Next.js 15.5.7+
    - 配置 TypeScript、ESLint
    - 设置 App Router 目录结构
    - _Requirements: 1.1, 9.2_
  - [x] 1.2 配置 package.json 依赖
    - 添加 Next.js 15.5.7+、React 19.0.1+ 依赖
    - 保留 Zustand、React Query、date-fns 等现有依赖
    - 移除 Vite、React Router 相关依赖
    - 使用精确版本号锁定依赖
    - _Requirements: 1.3, 9.1, 9.2, 9.3_
  - [x] 1.3 配置 next.config.js
    - 设置 output: 'export' 支持静态导出
    - 配置 API rewrites 用于开发环境代理
    - 配置图片优化选项 (unoptimized: true)
    - _Requirements: 1.4, 5.3, 8.1_
  - [x] 1.4 配置 TypeScript
    - 适配 Next.js 的 tsconfig.json 要求
    - 保留现有的路径别名 (@/)
    - _Requirements: 1.2_

- [x] 2. 配置 Tailwind CSS 和 shadcn/ui
  - [x] 2.1 初始化 shadcn/ui
    - 运行 shadcn/ui init 命令
    - 配置 components.json
    - 设置主题变量
    - _Requirements: 3.1, 6.1_
  - [x] 2.2 迁移全局样式
    - 将现有 CSS 变量迁移到 globals.css
    - 配置亮色/暗色主题变量
    - _Requirements: 6.2_
  - [x] 2.3 安装基础 shadcn/ui 组件
    - 安装 button、input、dialog、toast、dropdown-menu、sheet、alert-dialog、select、form 组件
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 配置测试环境
  - [x] 3.1 配置 Vitest 和 React Testing Library
    - 安装 vitest, @testing-library/react, @testing-library/user-event, jsdom
    - 配置 vitest.config.ts
    - 创建测试 setup 文件
  - [x] 3.2 配置 Playwright
    - 初始化 Playwright 配置
    - 确保支持本地构建测试

- [x] 3. Checkpoint - 确保项目可以正常构建
  - 确保所有测试通过，如有问题请询问用户

## Phase 2: 核心基础设施

- [x] 4. 迁移状态管理和 API 客户端
  - [x] 4.1 迁移 Zustand stores
    - 复制 authStore、themeStore、toastStore
    - 确保在客户端组件中正常工作
    - _Requirements: 4.1_
  - [x] 4.2 迁移 API 客户端
    - 适配环境变量为 NEXT_PUBLIC_ 前缀
    - 保持现有的 token 刷新逻辑
    - _Requirements: 5.1, 5.2_
  - [x] 4.3 配置 React Query Provider
    - 创建客户端 Providers 组件
    - 配置 QueryClient
    - _Requirements: 4.2_
  - [x] 4.4 编写属性测试：Token 刷新流程
    - **Property 4: Token 刷新流程**
    - **Validates: Requirements 4.3**

- [x] 5. 创建布局系统
  - [x] 5.1 创建根布局 (app/layout.tsx)
    - 配置 HTML 结构和元数据
    - 集成 Providers
    - _Requirements: 2.3_
  - [x] 5.2 创建受保护路由布局 (app/(protected)/layout.tsx)
    - 实现认证检查逻辑
    - 未认证时重定向到登录页
    - _Requirements: 2.4_
  - [x] 5.3 编写属性测试：受保护路由认证检查
    - **Property 1: 受保护路由认证检查**
    - **Validates: Requirements 2.4**
  - [x] 5.4 编写属性测试：公开路由访问
    - **Property 2: 公开路由访问**
    - **Validates: Requirements 2.5**
  - [x] 5.5 创建 AppShell 布局组件
    - 迁移现有的 AppShell、FullScreenAppShell 组件
    - 适配 shadcn/ui 风格
    - _Requirements: 2.3_

- [x] 6. Checkpoint - 确保布局和认证正常工作
  - 确保所有测试通过，如有问题请询问用户

## Phase 3: 通用组件迁移

- [x] 7. 迁移通用 UI 组件
  - [x] 7.1 迁移 Toast 组件
    - 使用 shadcn/ui toast 替换现有实现
    - 适配 toastStore
    - _Requirements: 3.2_
  - [x] 7.2 迁移 Dialog 组件
    - 使用 shadcn/ui alert-dialog 替换 AlertDialog、ConfirmDialog
    - _Requirements: 3.2_
  - [x] 7.3 迁移 Drawer 组件
    - 使用 shadcn/ui sheet 替换现有 Drawer
    - _Requirements: 3.2_
  - [x] 7.4 迁移 DropdownMenu 组件
    - 使用 shadcn/ui dropdown-menu 替换
    - _Requirements: 3.2_
  - [x] 7.5 迁移主题切换组件
    - 使用 shadcn/ui 主题系统
    - 支持 light/dark/system 模式
    - _Requirements: 3.5_
  - [x] 7.6 编写属性测试：主题切换一致性
    - **Property 3: 主题切换一致性**
    - **Validates: Requirements 3.5**
  - [x] 7.7 编写属性测试：系统主题检测
    - **Property 5: 系统主题检测**
    - **Validates: Requirements 4.4**

- [x] 8. 迁移表单组件
  - [x] 8.1 迁移 Input 组件
    - 使用 shadcn/ui input
    - _Requirements: 3.3_
  - [x] 8.2 迁移 Select 组件
    - 使用 shadcn/ui select
    - _Requirements: 3.3_
  - [x] 8.3 迁移 Form 相关组件
    - 使用 shadcn/ui form 组件
    - _Requirements: 3.3_

## Phase 4: 认证页面迁移

- [x] 9. 迁移认证页面
  - [x] 9.1 创建登录页面 (app/(auth)/login/page.tsx)
    - 迁移 LoginPage 组件
    - 使用 shadcn/ui 表单组件
    - _Requirements: 7.4_
  - [x] 9.2 创建注册页面 (app/(auth)/register/page.tsx)
    - 迁移 RegisterPage 组件
    - 使用 shadcn/ui 表单组件
    - _Requirements: 7.4_
  - [x] 9.3 编写属性测试：JWT 认证流程
    - **Property 6: JWT 认证流程**
    - **Validates: Requirements 5.4**
  - [x] 9.4 编写属性测试：认证状态持久化
    - **Property 11: 认证状态持久化**
    - **Validates: Requirements 7.4**

- [x] 10. Checkpoint - 确保认证流程正常工作
  - 确保所有测试通过，如有问题请询问用户

## Phase 5: 主要页面迁移

- [x] 11. 迁移书签页面
  - [x] 11.1 创建书签页面 (app/(protected)/page.tsx)
    - 迁移 BookmarksPage 组件
    - _Requirements: 7.1_
  - [x] 11.2 迁移书签相关组件
    - BookmarkListContainer、BookmarkCardView、BookmarkListView 等
    - BookmarkForm、TagSidebar
    - _Requirements: 7.1_
  - [x] 11.3 编写属性测试：书签 CRUD 操作
    - **Property 8: 书签 CRUD 操作**
    - **Validates: Requirements 7.1**

- [x] 12. 迁移标签页组页面
  - [x] 12.1 创建标签页组列表页面 (app/(protected)/tab/page.tsx)
    - 迁移 TabGroupsPage 组件
    - _Requirements: 7.2_
  - [x] 12.2 创建标签页组详情页面 (app/(protected)/tab/[id]/page.tsx)
    - 迁移 TabGroupDetailPage 组件
    - 使用动态路由参数
    - _Requirements: 2.2, 7.2_
  - [x] 12.3 创建其他标签页组相关页面
    - TodoPage (app/(protected)/tab/todo/page.tsx)
    - TrashPage (app/(protected)/tab/trash/page.tsx)
    - StatisticsPage (app/(protected)/tab/statistics/page.tsx)
    - _Requirements: 7.2_
  - [x] 12.4 迁移标签页组相关组件
    - TabGroupCard、TabGroupSidebar、TabItem 等
    - _Requirements: 7.2_
  - [x] 12.5 编写属性测试：标签页组操作
    - **Property 9: 标签页组操作**
    - **Validates: Requirements 7.2**

- [x] 13. Checkpoint - 确保主要页面正常工作
  - 确保所有测试通过，如有问题请询问用户

## Phase 6: 设置和其他页面迁移

- [x] 14. 迁移设置页面
  - [x] 14.1 创建通用设置页面 (app/(protected)/settings/general/page.tsx)
    - 迁移 GeneralSettingsPage 组件
    - _Requirements: 7.3_
  - [x] 14.2 创建 API Keys 页面 (app/(protected)/api-keys/page.tsx)
    - 迁移 ApiKeysPage 组件
    - _Requirements: 7.3_
  - [x] 14.3 创建分享设置页面 (app/(protected)/share-settings/page.tsx)
    - 迁移 ShareSettingsPage 组件
    - _Requirements: 7.3_
  - [x] 14.4 创建导入导出页面 (app/(protected)/import-export/page.tsx)
    - 迁移 ImportExportPage 组件
    - _Requirements: 7.3_
  - [x] 14.5 迁移设置相关组件
    - SettingsTabs、各种设置 Tab 组件
    - _Requirements: 7.3_
  - [x] 14.6 编写属性测试：设置持久化
    - **Property 10: 设置持久化**
    - **Validates: Requirements 7.3**

- [x] 15. 迁移公开分享页面
  - [x] 15.1 创建公开分享页面 (app/share/[slug]/page.tsx)
    - 迁移 PublicSharePage 组件
    - 使用动态路由参数
    - _Requirements: 2.2, 7.5_
  - [x] 15.2 创建公开布局
    - 迁移 PublicAppShell 组件
    - _Requirements: 2.5_

- [x] 16. 迁移信息页面
  - [x] 16.1 创建关于页面 (app/(protected)/about/page.tsx)
    - 迁移 AboutPage 组件
  - [x] 16.2 创建帮助页面 (app/(protected)/help/page.tsx)
    - 迁移 HelpPage 组件
  - [x] 16.3 创建隐私政策页面 (app/(protected)/privacy/page.tsx)
    - 迁移 PrivacyPage 组件
  - [x] 16.4 创建服务条款页面 (app/(protected)/terms/page.tsx)
    - 迁移 TermsPage 组件
  - [x] 16.5 创建扩展页面 (app/(protected)/extension/page.tsx)
    - 迁移 ExtensionPage 组件

## Phase 7: 响应式和优化

- [x] 17. 响应式适配
  - [x] 17.1 验证移动端布局
    - 检查所有页面的移动端显示
    - 修复响应式问题
    - _Requirements: 6.4_
  - [x] 17.2 编写属性测试：响应式布局
    - **Property 7: 响应式布局**
    - **Validates: Requirements 6.4**

- [x] 18. 构建和部署配置
  - [x] 18.1 配置静态导出
    - 验证 output: 'export' 配置
    - 处理动态路由的静态生成
    - _Requirements: 8.1, 8.2_
  - [x] 18.2 配置 Cloudflare Pages
    - 创建 _routes.json 配置 SPA 路由回退
    - 配置构建命令
    - _Requirements: 8.3_
  - [x] 18.3 优化构建输出
    - 配置代码分割
    - 启用压缩
    - _Requirements: 8.4_
  - [x] 18.4 导出产物合并 Functions
    - 运行 prepare-deploy.js 生成 .deploy
    - _Requirements: 8.3_

- [x] 19. 安全检查
  - [x] 19.1 运行依赖安全审计
    - 运行 npm audit（高危已清除）
    - 确保无高危漏洞
    - _Requirements: 9.5, 9.6_

- [x] 20. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
