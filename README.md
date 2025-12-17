<div align="center">

# 🔖 TMarks

**AI 驱动的智能书签管理系统**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3%20%7C%2019-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0%20%7C%207-646cff.svg)](https://vitejs.dev/)
[![许可证](https://img.shields.io/badge/许可证-MIT-green.svg)](LICENSE)

简体中文

[在线演示](https://tmarks.669696.xyz) | [视频教程](https://bushutmarks.pages.dev/course/tmarks) | [问题反馈](https://github.com/ai-tmarks/tmarks/issues) | [功能建议](https://github.com/ai-tmarks/tmarks/discussions)

</div>

---

## ✨ 项目简介

TMarks 是一个现代化的智能书签管理系统，结合 AI 技术自动生成标签，让书签管理变得简单高效。

### 核心特性

- 📚 **智能书签管理** - AI 自动标签、多维筛选、批量操作、拖拽排序
- 🗂️ **标签页组管理** - 一键收纳标签页、智能分组、快速恢复
- 🌐 **公开分享** - 创建个性化书签展示页、Redis 缓存加速
- 🔌 **浏览器扩展** - 快速保存、AI 推荐、离线支持、自动同步
- 🔐 **安全可靠** - JWT 认证、API Key 管理、数据加密

### 技术栈

- **前端**: React 18/19 + TypeScript + Vite + TailwindCSS 3
- **后端（自托管）**: Next.js App Router + PostgreSQL + Redis + MinIO/本地存储（Dokploy / Docker Compose）
- **数据库**: PostgreSQL 16
- **缓存**: Redis
- **文件存储**: MinIO 或本地对象存储
- **AI 集成**: 支持 OpenAI、Anthropic、DeepSeek、智谱等 8+ 提供商

---

## 🚀 快速开始

### 本地开发（自托管）

```bash
# 1. 克隆项目
git clone https://github.com/ai-tmarks/tmarks.git
cd tmarks/tmarks

# 2. 安装依赖
pnpm install

# 3. 启动本地依赖（需要 docker）
docker compose -f docker-compose.dev.yml up -d postgres redis minio

# 4. 初始化数据库 / 存储
cp .env.example .env
./scripts/setup.sh .env

# 5. 启动开发服务器
pnpm dev
# 访问 http://localhost:3000
```

### 浏览器扩展开发

```bash
# 1. 安装依赖
cd tab
pnpm install

# 2. 启动开发模式
pnpm dev

# 3. 加载扩展
# Chrome: chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序 → 选择 tab/dist
# Firefox: about:debugging → 临时载入附加组件 → 选择 tab/dist/manifest.json
```

### 自托管 / Dokploy 开发环境（Docker Compose）

```bash
cp .env.example .env
# 修改 JWT_SECRET、POSTGRES_PASSWORD、MINIO_* 等敏感变量

# 启动依赖服务
docker compose -f docker-compose.dev.yml up -d postgres redis minio

# 安装依赖（挂载了本地代码与空的 node_modules 卷，需要执行一次）
docker compose -f docker-compose.dev.yml run --rm app pnpm install

# 初始化数据库 / MinIO bucket
docker compose -f docker-compose.dev.yml run --rm app ./scripts/setup.sh .env

# 启动开发模式（热重载）
docker compose -f docker-compose.dev.yml up app
# 访问 http://localhost:3000
```

### 自托管 / Dokploy 生产部署（Docker Compose）

Dokploy 可直接导入本仓库的 `Dockerfile` 与 `docker-compose.yml`。手动部署步骤：

```bash
cd tmarks/tmarks
cp .env.example .env
# 设置 JWT_SECRET / POSTGRES_PASSWORD / MINIO_* / DATABASE_URL 等值

# 启动依赖
docker compose up -d postgres redis minio

# 运行初始化脚本（迁移数据库 + 创建存储目录/桶）
docker compose run --rm app ./scripts/setup.sh .env

# 启动应用
docker compose up -d app

# 健康检查
curl http://localhost:3000/api/v1/health
```

## 🚀 部署

### 📹 视频教程

**完整部署教程视频**: [点击观看](https://bushutmarks.pages.dev/course/tmarks)

跟随视频教程，3 分钟完成部署。

---

### 开源用户一页部署指南

自托管快速步骤（Dokploy / Docker Compose）：
1. Fork 仓库并拉取代码到服务器。
2. 进入 `tmarks` 目录，复制并填写 `.env`（数据库、Redis、MinIO、JWT）。
3. `docker compose up -d postgres redis minio` 启动依赖。
4. `docker compose run --rm app ./scripts/setup.sh .env` 运行迁移与存储初始化。
5. `docker compose up -d app` 启动应用，健康检查 `GET /api/v1/health`。
---


## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。