# 文档索引

> 当前已实现系统的中文技术文档入口。

**最后更新**：2026-04-20
**当前包版本**：`0.3.0`

> 若旧文档与代码冲突，请优先以根 `README.md`、本索引和代码为准。

## 如何使用这些文档

| 区域 | 用途 |
|------|------|
| `README.md` | 当前项目概览与快速启动 |
| `docs/` | 当前实现说明、运维/开发参考 |
| `openspec/` | 需求约束、设计决策、变更提案 |
| `docs/archive/` | 历史资料与已归档设计说明 |

## 当前系统快照

- 三端门户：Customer / Staff / Admin
- Next.js 16 App Router + React 19
- Prisma 6.19 + PostgreSQL
- NextAuth.js v5 JWT Session
- Zammad 作为外部工单系统
- SSE 工单更新 + 持久化通知
- 可配置 AI provider，当前主要文档路径以 FastGPT 为主
- Vitest + Playwright 自动化测试

## 核心入口

| 文档 | 用途 | 状态 |
|------|------|------|
| [../README.md](../README.md) | 最新项目概览、运行方式、仓库结构 | ✅ 首选入口 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统组成与实现位置 | ✅ 当前 |
| [DATABASE.md](./DATABASE.md) | Prisma 模型与持久化说明 | ✅ 当前 |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | 认证、会话、路由保护 | ✅ 当前 |
| [API-REFERENCE.md](./API-REFERENCE.md) | API 路由导读与分类 | ✅ 当前 |
| [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md) | Zammad 集成与工单链路 | ✅ 当前 |
| [TESTING.md](./TESTING.md) | 测试工具与执行方式 | ✅ 当前 |
| [AI-CONFIGURATION-PERSISTENCE.md](./AI-CONFIGURATION-PERSISTENCE.md) | AI 配置持久化说明 | ✅ 当前 |
| [文档编写与编码规范.md](./文档编写与编码规范.md) | 中文文档编码与编写约定 | ✅ 参考 |

## 仍在进行中的设计 / 待办

下列文档更接近“规划中”而不是“当前实现事实”：

| 文档 | 状态 |
|------|------|
| [plans/2026-04-09-email-system-design.md](./plans/2026-04-09-email-system-design.md) | 设计草案；当前代码中未看到完整实现 |
| [superpowers/specs/2026-04-14-service-group-assignment-design.md](./superpowers/specs/2026-04-14-service-group-assignment-design.md) | 提案 / 设计稿；当前逻辑仍以 customer-staff binding 为中心 |
| [feedback/TODO-未实现功能清单.md](./feedback/TODO-未实现功能清单.md) | 待办快照，不是运行时真相 |

## 归档

- [archive/README.md](./archive/README.md) - 归档索引
- [archive/implemented/](./archive/implemented/) - 已实现的计划 / 设计稿
- [archive/historical/](./archive/historical/) - 历史分析与过时说明

## 建议优先核对的事实源

判断文档是否过期时，优先核对：

- `package.json`
- `prisma/schema.prisma`
- `src/auth.ts`
- `middleware.ts`
- `src/app/layout.tsx`
- `src/app/api/tickets/updates/stream/route.ts`
- `src/lib/sse/emitter.ts`
- `src/lib/ticket/auto-assign.ts`
- `src/lib/zammad/client.ts`
- `src/lib/ai/providers/index.ts`
- `src/i18n.ts`

## 外部参考

- [Next.js Documentation](https://nextjs.org/docs)
- [Auth.js / NextAuth](https://authjs.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Zammad REST API](https://docs.zammad.org/en/latest/api/)
