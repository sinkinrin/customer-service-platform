# 文档归档

此目录用于存放不应继续停留在主 `docs/` 导航层的资料。

**归档时间**：2026-04-15

---

## 已实现的计划

这些文档被归档，是因为其描述的工作已经在仓库中落地。

| 文档 | 归档原因 | 证据快照 |
|------|----------|----------|
| `implemented/plans/2026-02-07-ai-conversation-pgsql-migration-design.md` | 对话存储、评分和 admin 统计能力已存在于 schema、service、route 和测试中 | `prisma/schema.prisma`、`src/lib/ai-conversation-service.ts`、`src/app/api/conversations/[id]/messages/[messageId]/rating/route.ts`、`src/app/api/admin/stats/ai-conversations/route.ts` |
| `implemented/superpowers/specs/2026-04-09-attachment-inline-preview-design.md` | 同一能力已经在 UI 与附件路由中落地 | `src/components/ticket/article-content.tsx`、`src/components/conversation/message-list.tsx`、`src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts` |

## 历史文档

这些文档仅保留为历史上下文，不应再被当作当前指导。

当前已无仍需保留在 `docs/archive/historical/` 下的英文主文档。

## 未归档的活动文档

以下文档仍保留在主文档层，因为它们依然可执行或有参考价值。

| 文档 | 状态 |
|------|------|
| `../plans/2026-04-09-email-system-design.md` | 草案，尚未实现 |
| `../superpowers/specs/2026-04-14-service-group-assignment-design.md` | 提案阶段；当前代码中未发现 `ServiceGroup` 实现 |
| `../feedback/TODO-未实现功能清单.md` | 待办快照，仍有未完成项 |
