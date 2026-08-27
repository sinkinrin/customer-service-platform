# 文档索引

> 当前已实现系统的中文技术文档入口。

**最后更新**：2026-07-22
**当前包版本**：`0.4.0`

## 如何使用这些文档

| 区域 | 用途 |
|------|------|
| `README.md` | 项目总览、运行方式、仓库结构 |
| `docs/` | 当前实现说明、运维 / 开发参考、审计记录 |
| `openspec/` | 少量仍然有价值的当前规格与长期约束 |

## 当前系统快照

- 三端门户：Customer / Staff / Admin
- Next.js 16 App Router + React 19
- Prisma 6.19 + PostgreSQL
- NextAuth.js v5 JWT Session
- Zammad 作为外部工单系统真相来源
- webhook → `TicketUpdate` → SSE / polling fallback
- 可配置 AI provider，当前代码含 FastGPT / OpenAI-compatible / Yuxi legacy
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
| [DEVELOPMENT-WORKFLOW.md](./DEVELOPMENT-WORKFLOW.md) | 开发、测试和文档协作流程 | ✅ 当前 |
| [PROJECT-AUDIT-2026-07-22.md](./PROJECT-AUDIT-2026-07-22.md) | 全面审计的证据、发现、修复、最终门禁与发布结论 | ✅ 已完成（不可发布） |
| [PROJECT-AUDIT-PLAN.zh-CN.md](./PROJECT-AUDIT-PLAN.zh-CN.md) | 全面项目审查的执行计划 | ✅ 已完成 |
| [AI-CONFIGURATION-PERSISTENCE.md](./AI-CONFIGURATION-PERSISTENCE.md) | AI 配置持久化说明 | ✅ 当前 |
| [SECURITY-DEPENDENCY-AUDIT-2026-07-03.md](./SECURITY-DEPENDENCY-AUDIT-2026-07-03.md) | 当前依赖漏洞审计与整改结果 | ✅ 当前审计 |
| [SECURITY-AUDIT-2026-03-31.md](./SECURITY-AUDIT-2026-03-31.md) | 历史安全审计记录 | ✅ 历史参考 |
| [数据结构与接口约定.zh-CN.md](./数据结构与接口约定.zh-CN.md) | 中文数据结构与接口约定 | ✅ 参考 |
| [文档编写与编码规范.md](./文档编写与编码规范.md) | 文档与编码约定 | ✅ 参考 |

## 文档保留规则

当前仓库不再保留大批计划稿、反馈快照、归档目录和 OpenSpec 历史提案。现在只保留：

- 能说明**当前代码事实**的文档
- 能沉淀**审计 / 踩坑 / 运维经验**的文档

如果某份材料只是一次性 proposal、过时计划或中间产物，就不应继续留在主仓库。

## 建议优先核对的事实源

判断文档是否过期时，优先核对：

- `package.json`
- `prisma/schema.prisma`
- `src/auth.ts`
- `middleware.ts`
- `src/app/layout.tsx`
- `src/app/api/tickets/updates/stream/route.ts`
- `src/app/api/webhooks/zammad/route.ts`
- `src/lib/ticket/auto-assign.ts`
- `src/lib/zammad/client.ts`
- `src/lib/ai/providers/index.ts`
- `src/i18n.ts`

## 外部参考

- [Next.js Documentation](https://nextjs.org/docs)
- [Auth.js / NextAuth](https://authjs.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Zammad REST API](https://docs.zammad.org/en/latest/api/)
