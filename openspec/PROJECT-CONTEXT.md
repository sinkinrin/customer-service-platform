# 项目上下文（兼容入口）

> 保留此文件，是因为旧的 OpenSpec 提案和历史说明仍然链接到它。
>
> 当前维护中的真相入口是 [`project.md`](./project.md)。关于系统总览，也请参考根目录 [`README.md`](../README.md) 与 [`docs/README.md`](../docs/README.md)。

## 当前快照

| 领域 | 当前值 |
|------|--------|
| Framework | Next.js 16 App Router |
| Language | TypeScript 5.3 |
| Database | PostgreSQL via Prisma 6.19 |
| Auth | NextAuth.js v5 JWT sessions |
| Ticketing | Zammad REST API |
| Real-time | SSE ticket updates |
| AI | FastGPT provider integration |
| i18n | next-intl（`en`、`zh-CN`、`fr`、`es`、`ru`、`pt`） |
| Testing | Vitest + Playwright |

## 当前领域模型

- **Customer**：FAQ、自助对话、建单、工单跟踪、附件回复
- **Staff**：工单处理、附件回复、AI 质检、分配相关工作流
- **Admin**：用户 / FAQ / 设置管理，以及 customer-staff binding 管理
- **本地 Prisma 数据**：FAQ、上传文件、工单评分、回复模板、TicketUpdate、Notification、AI 对话与质检数据

## 文档边界

- `docs/`：当前实现、开发与运维说明
- `openspec/`：规格、提案、设计意图
- `openspec/changes/archive/`：已完成的 OpenSpec 变更提案归档
- `docs/archive/`：历史资料与已归档设计文档

## 迁移说明

仓库中的更早文档仍可能提到 SQLite、旧 API 数量或过时路径。这些内容都是历史说明，不应再被视为当前架构事实。
