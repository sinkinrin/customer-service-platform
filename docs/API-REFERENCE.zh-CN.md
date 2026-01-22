# API 参考（中文）

> 本文档是 `docs/API-REFERENCE.md` 的中文导读版：先把“统一约定 + 分类 + 真实实现位置”讲清楚。需要逐个 endpoint 的详细参数/示例时，请以英文文档为准。

**最后更新**：2026-01-22
**Base URL**：`/api`

---

## 1) 统一响应格式

实现来源：`src/types/api.types.ts`、`src/lib/utils/api-response.ts`

### 成功

```json
{ "success": true, "data": { } }
```

### 失败

```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "message", "details": {} }
}
```

---

## 2) 认证与权限（摘要）

实现来源：

- NextAuth：`src/auth.ts`
- 服务端辅助：`src/lib/utils/auth.ts`
- 权限规则：`src/lib/utils/permission.ts`

要点：

- 未登录：
  - 页面路由：重定向到 `/auth/login`
  - API 路由：通常返回 401 JSON（具体看各 route.ts 的实现）
- 角色限制（高层）：
  - `/admin/*`：admin
  - `/staff/*`：staff 或 admin
  - `/customer/*`：登录即可

---

## 3) 路由组织方式

实现来源：`src/app/api/**/route.ts`

- Next.js App Router 下，文件路径决定 URL 路径
- 例如：`src/app/api/tickets/updates/route.ts` → `GET /api/tickets/updates`

---

## 4) 重点模块索引（常用）

### Tickets（工单）

- 列表/创建：`src/app/api/tickets/route.ts`
- 详情/更新/回复：`src/app/api/tickets/[id]/route.ts`
- 文章/附件：`src/app/api/tickets/[id]/articles/route.ts` 等
- 搜索：`src/app/api/tickets/search/route.ts`
- 导出：`src/app/api/tickets/export/route.ts`

### Ticket Updates（实时）

- 轮询：`src/app/api/tickets/updates/route.ts`
- SSE：`src/app/api/tickets/updates/stream/route.ts`
- Webhook 入站：`src/app/api/webhooks/zammad/route.ts`

### Notifications（站内通知）

- `src/app/api/notifications/*`
- 服务层：`src/lib/notification/service.ts`

### FAQ

- `src/app/api/faq/*`

### Admin

- `src/app/api/admin/*`

---

## 5) 建议搭配阅读的“细节约定”

- `docs/数据结构与接口约定.zh-CN.md`：Session 字段、TicketUpdate payload、SSE 事件格式、Webhook 签名、X-On-Behalf-Of 等

