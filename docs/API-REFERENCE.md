# API 参考

> 当前 API 体系的导读版，重点讲清统一规则、路由族和真实实现边界。

**最后更新**：2026-04-20
**Base URL**：`/api`

---

## 总览

仓库当前在 `src/app/api/` 下包含较多 Next.js Route Handlers。

由于这部分会持续变化，这份文档不再维护固定的“XX 个 routes”静态数字，而是重点说明：

- 统一响应格式
- 认证与权限模型
- 路由家族划分
- 关键实现入口
- 重要边界

精确路由清单应以 `src/app/api/**/route.ts` 为准。

---

## 统一响应格式

多数平台 API 使用：

- `src/lib/utils/api-response.ts`
- `src/types/api.types.ts`

常见成功结构：

```json
{
  "success": true,
  "data": {}
}
```

常见失败结构：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## 认证与权限

认证相关核心层：

- NextAuth 配置：`src/auth.ts`
- 中间件保护：`middleware.ts`
- 服务端辅助：`src/lib/utils/auth.ts`

常见 route handler 模式：

- `requireAuth()`：要求已登录
- `requireRole([...])`：要求指定角色
- 工单相关接口再叠加 `src/lib/utils/permission.ts` 或 `src/lib/utils/region-auth.ts`

高层规则：

- 未登录访问受保护页面 → 跳转 `/auth/login`
- 未登录访问受保护 API → 返回 `401`
- admin 路由通常要求 `admin`
- staff 路由通常要求 `staff` 或 `admin`
- customer 路由通常要求登录后再做资源级校验

---

## 主要路由家族

### 认证

- `src/app/api/auth/[...nextauth]/route.ts`

提供 NextAuth 的登录 / session / 登出处理。

---

### 工单

重要工单路由包括：

- `src/app/api/tickets/route.ts`
- `src/app/api/tickets/[id]/route.ts`
- `src/app/api/tickets/[id]/articles/route.ts`
- `src/app/api/tickets/[id]/assign/route.ts`
- `src/app/api/tickets/[id]/rating/route.ts`
- `src/app/api/tickets/[id]/reopen/route.ts`
- `src/app/api/tickets/search/route.ts`
- `src/app/api/tickets/export/route.ts`
- `src/app/api/tickets/auto-assign/route.ts`

这一组本质上是对 Zammad 工单能力的包装，加上平台自己的校验、权限和返回格式。

---

### 工单更新 / 实时链路

- `src/app/api/tickets/updates/route.ts`
- `src/app/api/tickets/updates/stream/route.ts`
- `src/app/api/webhooks/zammad/route.ts`

这组路由共同支撑 webhook → 本地持久化 → SSE / 轮询 的更新链路。

---

### 通知

- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/unread-count/route.ts`
- `src/app/api/notifications/read-all/route.ts`
- `src/app/api/notifications/[id]/read/route.ts`
- `src/app/api/notifications/[id]/route.ts`

这一组是本地 Prisma 通知系统，不是 Zammad 原生通知接口。

---

### FAQ

客户侧 FAQ：

- `src/app/api/faq/route.ts`
- `src/app/api/faq/categories/route.ts`
- `src/app/api/faq/[id]/route.ts`
- `src/app/api/faq/[id]/rating/route.ts`

Admin FAQ 管理：

- `src/app/api/admin/faq/route.ts`
- `src/app/api/admin/faq/categories/route.ts`
- `src/app/api/admin/faq/articles/route.ts`

这套 FAQ 是 Prisma 本地实现，不是 Zammad KB 代理。

---

### Conversations / AI

客户 AI 对话路由：

- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[id]/route.ts`
- `src/app/api/conversations/[id]/messages/route.ts`
- `src/app/api/conversations/[id]/mark-read/route.ts`
- `src/app/api/conversations/[id]/messages/[messageId]/rating/route.ts`

其他 AI 路由还包括：

- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/health/route.ts`
- `src/app/api/admin/settings/ai/route.ts`
- `src/app/api/admin/settings/ai/test/route.ts`
- `src/app/api/staff/ai-qa/*`
- `src/app/api/staff/ai/*`

---

### 用户资料与账户

- `src/app/api/user/profile/route.ts`
- `src/app/api/user/password/route.ts`
- `src/app/api/user/preferences/route.ts`
- `src/app/api/user/avatar/route.ts`
- `src/app/api/avatars/[id]/route.ts`

---

### 文件与附件

这里有两套不同链路：

#### 本地文件元数据 / 存储

- `src/app/api/files/upload/route.ts`
- `src/app/api/files/[id]/route.ts`
- `src/app/api/files/[id]/download/route.ts`

#### Zammad 附件链路

- `src/app/api/attachments/upload/route.ts`
- `src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`

整理文档时，不能把它们写成同一个存储系统。

---

### Staff 路由

例如：

- `src/app/api/staff/available/route.ts`
- `src/app/api/staff/vacation/route.ts`
- `src/app/api/staff/ai/*`
- `src/app/api/staff/ai-qa/*`

主要服务于坐席可用性、分配辅助和 staff 侧 AI 工具。

---

### Admin 路由

当前 admin API 主要包括：

- `src/app/api/admin/users/*`
- `src/app/api/admin/faq/*`
- `src/app/api/admin/settings/*`
- `src/app/api/admin/stats/*`
- `src/app/api/admin/triggers/*`
- `src/app/api/admin/customer-bindings/*`
- `src/app/api/admin/ai-export/route.ts`

这一区域适合按“路由家族”理解，不适合维护一个很快过期的静态数字。

---

### Templates

- `src/app/api/templates/route.ts`
- `src/app/api/templates/[id]/route.ts`

用于管理本地 Prisma 中的回复模板。

---

### 健康检查与运维辅助

- `src/app/api/health/route.ts`
- `src/app/api/health/zammad/route.ts`
- `src/app/api/openapi.json/route.ts`
- `src/app/api/sessions/*`
- `src/app/api/dev/auto-login/route.ts`

其中一部分偏运维 / 调试用途，不是产品主流程接口。

---

## 重要边界

### Ticket 真相 vs 本地支撑数据

很多工单 API 同时会涉及：

- Zammad-backed 的 ticket / article 真相
- 平台本地的 rating / notification / ticket update / binding 等支撑数据

写文档时最好明确每类数据到底归谁负责。

### FAQ 是本地实现

当前 FAQ API 明确是 Prisma 本地实现，不是 Zammad Knowledge Base。

### AI 不是单一 FastGPT

管理端 AI 设置和运行时 provider 在代码层面已经不是 FastGPT-only。

### 实时更新是混合模式

当前既有：

- SSE stream
- polling fallback
- 持久化通知

不能只写成“实时 = WebSocket”或“实时 = 单纯轮询”。

---

## 常见实现模式

当前 API 中普遍能看到这些模式：

- Zod 做请求参数 / 请求体校验
- `requireAuth()` / `requireRole()` 做认证授权
- 依赖 Zammad 的接口会先做健康检查
- 工单可见性会再过一层权限过滤
- 统一通过 response helper 生成 JSON

---

## 如何核对当前状态

判断 API 文档是否过期时，优先看：

- `src/app/api/**/route.ts`
- `src/lib/utils/api-response.ts`
- `src/lib/utils/auth.ts`
- `src/lib/utils/permission.ts`
- `src/lib/zammad/client.ts`

---

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AUTHENTICATION.md](./AUTHENTICATION.md)
- [DATABASE.md](./DATABASE.md)
- [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md)
