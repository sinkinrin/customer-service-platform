# 客户服务平台

> 一个基于 Next.js、Prisma 和 Zammad 的三端客户服务平台。

**当前包版本**：`0.4.0`
**项目总览入口**：本文件
**技术文档入口**：[`docs/README.md`](./docs/README.md)

## 项目概览

本仓库实现了一个面向三类角色的客户服务平台：

- **Customer**：浏览 FAQ、发起 AI 对话、创建并跟踪工单、带附件回复
- **Staff**：处理工单、回复客户、使用 AI 助手与 AI QA 工具
- **Admin**：管理用户、FAQ、AI 设置、customer-staff binding 与运营配置

## 当前能力

- **认证与 RBAC**：NextAuth.js v5 + Credentials，Zammad 优先认证，mock / env 回退
- **工单流程**：基于 Zammad REST API，按场景使用 `X-On-Behalf-Of`
- **分配逻辑**：binding-aware auto assign，而不是早期纯 region 分配
- **实时更新**：webhook → `TicketUpdate` → SSE / polling fallback
- **站内通知**：Prisma 持久化通知 + 前端轮询刷新
- **AI 能力**：客户 AI 对话、staff AI 助手、AI QA review，多 provider 配置
- **FAQ 与多语言界面**：Prisma 本地 FAQ + `next-intl` 6 种语言
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
| 实时更新 | SSE（`/api/tickets/updates/stream`）+ polling fallback |
| AI | FastGPT / OpenAI-compatible / Yuxi legacy |
| 国际化 | `en`、`zh-CN`、`fr`、`es`、`ru`、`pt` |
| 测试 | Vitest + Playwright |

## 关键入口

- 认证配置：`src/auth.ts`
- 路由保护：`middleware.ts`
- 根布局与 Provider：`src/app/layout.tsx`
- Prisma Schema：`prisma/schema.prisma`
- Zammad 客户端：`src/lib/zammad/client.ts`
- 自动分配：`src/lib/ticket/auto-assign.ts`
- 通知服务：`src/lib/notification/service.ts`
- SSE Stream：`src/app/api/tickets/updates/stream/route.ts`
- Webhook 入站：`src/app/api/webhooks/zammad/route.ts`
- AI Provider 注册：`src/lib/ai/providers/index.ts`

## 快速开始

### 前置条件

- Node.js 20+
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
docs/                 # 当前实现文档、审计与约定
openspec/             # 当前规格与少量长期约束
```

## 文档地图

- [`docs/README.md`](./docs/README.md) - 当前技术文档入口
- [`docs/DEVELOPMENT-WORKFLOW.md`](./docs/DEVELOPMENT-WORKFLOW.md) - 开发、测试和文档协作流程
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) - 系统组成与实现位置
- [`docs/SECURITY-AUDIT-2026-03-31.md`](./docs/SECURITY-AUDIT-2026-03-31.md) - 历史安全审计记录
- [`docs/SECURITY-DEPENDENCY-AUDIT-2026-07-03.md`](./docs/SECURITY-DEPENDENCY-AUDIT-2026-07-03.md) - 当前依赖漏洞审计记录
- [`openspec/README.md`](./openspec/README.md) - 精简后的 OpenSpec 使用说明
- [`openspec/project.md`](./openspec/project.md) - OpenSpec 项目上下文

## 文档原则

这个仓库现在只保留两类文档：

1. **当前实现事实**
2. **仍有参考价值的审计 / 踩坑记录**

如果文档与代码冲突，请优先信任代码，然后修正文档。
