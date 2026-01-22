# 架构概览（中文）

> 该文档是 `docs/ARCHITECTURE.md` 的中文概览版，重点给出“系统如何组成/关键链路/实现位置”。细节以英文文档与代码为准。

**最后更新**：2026-01-22

---

## 1. 系统组成

- **门户**：Customer（客户）、Staff（坐席）、Admin（管理员）
- **运行形态**：Next.js（App Router）+ 同仓库 API Routes
- **外部系统**：Zammad（工单/用户/知识库等）
- **本地数据**：Prisma + SQLite（FAQ、通知、评分、模板、SSE 更新事件等）

---

## 2. 关键目录与入口

- 路由（页面/服务端组件）：`src/app/`
- API Routes：`src/app/api/`（当前统计：69 个 `route.ts`）
- 认证配置：`src/auth.ts`
- 路由保护：`middleware.ts`（以及 `src/auth.ts` 中的 `authorized` 回调）
- Prisma 单例：`src/lib/prisma.ts`
- Zammad 客户端：`src/lib/zammad/client.ts`
- 区域/组映射：`src/lib/constants/regions.ts`
- SSE 推送：
  - SSE stream：`src/app/api/tickets/updates/stream/route.ts`
  - SSE emitter：`src/lib/sse/emitter.ts`
  - Webhook 入站写入/广播：`src/app/api/webhooks/zammad/route.ts`

---

## 3. 认证与权限模型（摘要）

### 角色

- `customer`：客户门户（以及其自己的工单）
- `staff`：坐席门户（通常按区域/组过滤工单）
- `admin`：管理员门户（全局能力）

### 角色/区域来源（与实现一致）

- 角色：根据 Zammad `role_ids` 映射（见 `src/auth.ts` 与 `src/lib/constants/zammad.ts`）
- 区域：
  - 客户：从 Zammad `note` 中解析 `Region: <region>`（见 `getRegionFromNote`）
  - 坐席/管理员：从 Zammad `group_ids` 中找 `full` 权限的 group，映射到 region（见 `getRegionFromGroupIds` + `getRegionByGroupId`）

---

## 4. 实时更新（SSE + 轮询兜底）

### 为什么不是 WebSocket

当前实现使用 SSE（浏览器端 `EventSource`）来推送工单更新事件，并在失败时回退到轮询，减少复杂度。

### 关键实现

- 前端连接：`src/lib/hooks/use-ticket-sse.ts`
- 全局 Provider：`src/components/providers/ticket-updates-provider.tsx`
- 服务端 SSE：`src/app/api/tickets/updates/stream/route.ts`
- 事件来源：Zammad webhook → `src/app/api/webhooks/zammad/route.ts` 写入 `TicketUpdate` 并广播 SSE

---

## 5. 数据存储（Prisma + SQLite）

- Schema：`prisma/schema.prisma`
- 迁移：`prisma/migrations/`
- 说明：本项目当前 Prisma datasource `provider = "sqlite"`；如需 PostgreSQL 需要调整 schema 并重新生成/应用迁移。

---

## 6. 建议补充的深度文档（下一步）

- “权限与区域模型”单独成章（面向运维/实施）：角色、region、group 的约束与排查手册
- “Webhook/SSE 事件字典”：`TicketUpdate.event` 的枚举与 UI 处理逻辑
- “数据库迁移与环境一致性”：SQLite 路径、迁移策略、发布流程（避免 drift）

