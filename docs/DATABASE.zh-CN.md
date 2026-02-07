# 数据库概览（中文）

> 该文档是 `docs/DATABASE.md` 的中文概览版，重点说明"哪些数据在本地/哪些在 Zammad"、以及迁移注意事项。

**最后更新**：2026-01-22

---

## 1. 本地数据库负责什么

工单核心数据在 Zammad（外部系统）。本地 Prisma/PostgreSQL 主要承载：

- FAQ（分类/文章/多语言内容/点赞）
- 文件元数据（上传记录）
- 通知（站内通知）
- 工单评分（`TicketRating`）
- 快捷回复模板（`ReplyTemplate`）
- 工单更新事件（`TicketUpdate`，用于 SSE/轮询）

Schema：`prisma/schema.prisma`

---

## 2. 迁移（migrations）

迁移目录：`prisma/migrations/`

当前仓库内的迁移（以文件夹名为准）：

- `20251110114117_init`：FAQ 相关表
- `20251222105357_add_user_mapping_and_file_upload`：用户映射 + 上传文件元数据
- `20260112090000_add_notifications`：站内通知
- `20260122015327_add_ticket_models`：工单评分/模板/更新事件

---

## 3. PostgreSQL 连接配置

数据库连接通过环境变量 `DATABASE_URL` 配置：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/customer_service
```

要点：

- 确保 PostgreSQL 服务已启动且可访问
- 用户需具有创建表和执行迁移的权限
- 生产环境建议使用连接池（如 PgBouncer）

---

## 4. Prisma Client 单例

实现位置：`src/lib/prisma.ts`

要点：

- 开发环境使用单例避免热更新导致的多实例连接问题

