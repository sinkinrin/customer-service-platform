# Zammad 集成（中文）

> 该文档是 `docs/ZAMMAD-INTEGRATION.md` 的中文概览版，重点描述真实实现：ZammadClient、X-On-Behalf-Of、Webhook → TicketUpdate → SSE/轮询链路，以及 region/group 映射。

**最后更新**：2026-01-22

---

## 1) 集成边界

- Zammad 是工单系统的“事实来源”（tickets/articles/users/groups 等）
- 本系统负责：
  - UI（客户/坐席/管理员门户）
  - 认证（Zammad 登录优先）
  - 本地增强功能（通知/评分/模板/更新事件等）

---

## 2) 环境变量与权限

```env
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=<admin-token-with-admin.user-permission>

# 可选：Webhook 签名校验
ZAMMAD_WEBHOOK_SECRET=<webhook-signature-secret>
```

Token 权限要点：

- `admin.user`：使用 `X-On-Behalf-Of` 代办/冒名时必需
- 需要能访问所有 region 对应的 groups（跨区域分配/统计/检索等）

---

## 3) ZammadClient（调用入口）

实现位置：`src/lib/zammad/client.ts`（单例：`export const zammadClient = new ZammadClient()`）

关键特性：

- 默认从环境变量读取 `ZAMMAD_URL`、`ZAMMAD_API_TOKEN`
- 支持 `onBehalfOf?: string` 参数 → Header `X-On-Behalf-Of`
- 超时与重试（见构造函数参数与 `request()` 实现）

---

## 4) X-On-Behalf-Of（为什么要用）

实现位置：`src/lib/zammad/client.ts`

目的：

- 统一用一个管理员 token 调用 Zammad API
- 同时保留“操作人身份”（客户/坐席），让 Zammad 侧的 customer/文章发件人等保持正确

典型用法（从路由实现中可见）：

- Customer：常用 `X-On-Behalf-Of`，让 Zammad 自己保证“只能访问自己的 ticket”
- Staff/Admin：部分读写不使用 `X-On-Behalf-Of`，而是在本系统侧做 region/权限过滤

---

## 5) Webhook → TicketUpdate → SSE/轮询（实时链路）

### 入站 Webhook

- 路由：`POST /api/webhooks/zammad`
- 实现：`src/app/api/webhooks/zammad/route.ts`

行为：

- 可选验签（`ZAMMAD_WEBHOOK_SECRET` + `X-Hub-Signature`/`X-Zammad-Signature`）
- 推断事件类型（created/article_created/assigned/status_changed）
- 写入本地表 `TicketUpdate`（Prisma：`prisma.ticketUpdate.create`）
- 通过 `sseEmitter.broadcast()` 定向推送（owner + customer；admin 自动接收）

### SSE 推送

- 路由：`GET /api/tickets/updates/stream`
- 实现：`src/app/api/tickets/updates/stream/route.ts`
- payload：见 `docs/数据结构与接口约定.zh-CN.md`（`event: connected` / `event: ticket-update`）

### 轮询兜底

- 路由：`GET /api/tickets/updates?since=<timestamp>`
- 实现：`src/app/api/tickets/updates/route.ts`
- 注意：该接口会基于 `TicketUpdate.data` 中的 `customerId/ownerId/groupId` 做权限过滤（不足信息时不会返回）

---

## 6) region ↔ group 映射

实现位置：`src/lib/constants/regions.ts`

示例（节选）：

- `asia-pacific` → group `4`
- `europe-zone-1` → group `2`

用途：

- 工单创建时把 region 路由到正确 group
- staff 按 group 限制可见范围（并排除未分配工单）

