# 客户服务平台

> 一个基于 Next.js、Prisma 和 Zammad 的三端客户服务平台。

**当前包版本**：`0.2.2`
**项目总览入口**：本文件
**详细文档**：[`docs/README.md`](./docs/README.md)

> 文档正在持续校准。判断当前事实时，优先以代码、本 README 和 `docs/README.md` 为准，而不是历史说明。

## 项目概览

本仓库实现了一个面向三类角色的客户服务平台：

- **Customer**：浏览 FAQ、发起 AI 对话、创建并跟踪工单、带附件回复
- **Staff**：处理工单、回复客户、处理分配相关流程、复核 AI 回复质量
- **Admin**：管理用户、FAQ、AI 设置，以及 customer-staff binding

## 当前能力

- **认证与 RBAC**：NextAuth.js v5 + Credentials，Zammad 优先认证，mock/env 回退
- **工单流程**：基于 Zammad REST API，并支持 `X-On-Behalf-Of`
- **绑定优先分配**：customer-staff binding + 假期回退 + 负载均衡
- **实时更新**：SSE 工单更新 + 持久化站内通知
- **AI 对话与质检**：支持多 provider 配置，当前主文档以 FastGPT 路径为主
- **FAQ 与多语言界面**：`next-intl`，支持 6 种语言
- **附件预览与拖拽上传**：覆盖对话与工单回复场景
- **自动化测试**：Vitest + Playwright

## 架构速览

| 区域 | 当前实现 |
|------|----------|
| 框架 | Next.js 16 App Router |
| 语言 | TypeScript 5.3 |
| UI | React 19 + Tailwind CSS + shadcn/ui |
| 认证 | NextAuth.js v5 JWT Session |
| 本地数据 | Prisma 6.19 + PostgreSQL |
| 外部工单系统 | Zammad REST API |
| 实时更新 | SSE（`/api/tickets/updates/stream`） |
| AI | 可配置 provider，代码中含 FastGPT / OpenAI-compatible / Yuxi legacy |
| 国际化 | next-intl（`en`、`zh-CN`、`fr`、`es`、`ru`、`pt`） |
| 测试 | Vitest + Playwright |

## 关键入口

- 认证配置：`src/auth.ts`
- 路由保护：`middleware.ts`
- 根布局与 Provider：`src/app/layout.tsx`
- Prisma Schema：`prisma/schema.prisma`
- Zammad 客户端：`src/lib/zammad/client.ts`
- 自动分配：`src/lib/ticket/auto-assign.ts`
- SSE Stream：`src/app/api/tickets/updates/stream/route.ts`
- SSE Emitter：`src/lib/sse/emitter.ts`
- AI Provider 注册：`src/lib/ai/providers/index.ts`

## 快速开始

### 前置条件

- Node.js 18+
- PostgreSQL
- 可访问的 Zammad 实例
- 可选：FastGPT 或其他 AI provider 服务

### 安装与运行

```bash
npm install
cp .env.example .env.local

# 配置 AUTH_SECRET、DATABASE_URL、ZAMMAD_URL、ZAMMAD_API_TOKEN
npx prisma migrate dev
npm run db:seed
npm run dev
```

开发服务器默认运行在 `http://localhost:3010`。

### 常用脚本

```bash
npm run dev
npm run dev:turbo
npm run build
npm run start
npm run lint
npm run type-check
npm run test
npm run test:coverage
npm run test:e2e
npm run i18n:check
```

## 关键环境变量

```env
AUTH_SECRET=your_auth_secret_here
DATABASE_URL=postgresql://user:password@localhost:5432/customer_service
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=your_zammad_api_token

# Optional
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true
FASTGPT_API_KEY=your_fastgpt_api_key
LOG_LEVEL=info
```

## 仓库结构

```text
src/
├── app/              # App Router 页面和 API Routes
├── components/       # UI 与业务组件
├── lib/              # auth、Zammad、tickets、AI、notifications、SSE
├── types/            # 共享 TypeScript 类型
prisma/               # schema、migrations、seed
messages/             # i18n 文案
docs/                 # 当前实现文档与归档
openspec/             # specs、proposal、change 管理
```

## 文档地图

- [`docs/README.md`](./docs/README.md) - 当前技术文档入口
- [`docs/archive/README.md`](./docs/archive/README.md) - 已归档计划与历史说明
- [`openspec/README.md`](./openspec/README.md) - OpenSpec 工作流与目录说明
- [`openspec/project.md`](./openspec/project.md) - OpenSpec 项目上下文

## 文档整理说明

仓库中仍保留部分历史设计稿、归档计划和旧说明。整理策略是：

1. 先建立可信的中文主入口
2. 再把核心文档校准到当前代码事实
3. 最后删除或归档被覆盖的旧材料

如果历史说明与当前代码冲突，请优先信任代码和当前中文索引。
