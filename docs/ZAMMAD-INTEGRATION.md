# Zammad 集成

> 当前 Zammad 集成边界、关键文件与真实链路说明。

**最后更新**：2026-04-20

---

## 总览

Zammad 是这个平台背后的外部工单系统。

当前职责边界是：

- **Zammad**：ticket、ticket article、group 路由、大量用户记录、out-of-office 元数据、附件缓存链路
- **平台**：UI、认证编排、站内通知、ticket rating、reply template、FAQ、AI 数据、TicketUpdate 持久化、binding-aware 分配

如果文档把平台数据库写成工单真相来源，那就是过期了。

---

## 配置

核心环境变量：

```env
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=<admin token>
```

可选 Webhook 安全变量：

```env
ZAMMAD_WEBHOOK_SECRET=<webhook signature secret>
```

客户端实现位置：

- `src/lib/zammad/client.ts`

---

## ZammadClient 负责什么

`src/lib/zammad/client.ts` 是当前访问 Zammad REST API 的统一入口。

它现在承担的职责包括：

- Zammad 用户认证
- ticket 相关操作
- article 与附件相关操作
- 用户查询 / 创建 / 更新
- agent 与 group 获取
- out-of-office 操作
- 一些历史遗留的 knowledge-base 相关方法
- 请求超时与重试处理

当前实现特征：

- 从环境变量读取并规范化 base URL
- 通过统一 request 方法发请求
- 在请求时做配置校验
- 对部分失败做重试
- 内置 timeout 处理

---

## X-On-Behalf-Of 模式

平台会在需要时使用 admin token + `X-On-Behalf-Of` 来保留真实操作者身份。

当前用法不是“所有请求都冒名”，而是分场景：

- **Customer 工单动作**：常使用 `X-On-Behalf-Of`，让 Zammad 自己保证客户只能看到自己的数据
- **Staff / Admin 流程**：有些场景更多依赖平台侧权限过滤，而不是每次都在 Zammad 层 impersonate
- **附件下载**：工单文章附件下载路由对所有角色都走 `X-On-Behalf-Of`

因此文档里不能把它简化成“平台统一以用户身份请求 Zammad”。

---

## 认证集成

Zammad 不只是工单依赖，也是认证链路的一部分。

在 `src/auth.ts` 中：

- 可以直接用用户邮箱 / 密码去 Zammad 做认证
- 返回的 Zammad 用户会被转换成平台 session user
- role / region 都会基于 Zammad 信息推导

所以一旦启用了 Zammad-backed auth，Zammad 就是身份体系的关键依赖。

---

## 工单创建与更新

重要工单 API 包括：

- `src/app/api/tickets/route.ts`
- `src/app/api/tickets/[id]/route.ts`
- `src/app/api/tickets/[id]/articles/route.ts`
- `src/app/api/tickets/[id]/assign/route.ts`
- `src/app/api/tickets/auto-assign/route.ts`

平台在调用 Zammad 工单 API 时，通常还会叠加：

- 请求参数校验
- 认证与角色检查
- 资源级权限判断
- 健康检查 / 不可用处理
- 本地副作用（通知、binding 更新等）

---

## 当前分配模型

当前分配架构是 **binding-aware**。

`src/lib/ticket/auto-assign.ts` 的当前大致顺序：

1. 从 Zammad 拉取 active agents
2. 过滤出 eligible agents
3. 优先检查 customer 是否已有 active binding
4. 绑定坐席不可用时处理 fallback / replacement
5. 否则在目标 group 中按负载均衡选择
6. 首次成功分配后可自动创建 binding

相关文件：

- `src/lib/ticket/auto-assign.ts`
- `src/lib/ticket/agent-helpers.ts`
- `src/lib/ticket/customer-binding.ts`
- `src/app/api/admin/customer-bindings/route.ts`

所以旧文档里那种“纯 region 分配”或“纯 service-group 分配”不能再当作当前事实。

---

## Region 与 Group 映射

Region / group 的映射辅助在：

- `src/lib/constants/regions.ts`

这些映射被用于：

- 建单时把工单路由到正确 Zammad group
- 从 staff / admin 的 group 权限反推 region
- 自动分配时筛选候选人
- 一部分工单可见性判断

---

## 假期与可用性

Staff 的 out-of-office / vacation 真相仍在 Zammad。

当前代码会通过 Zammad 用户数据判断可用性，位置例如：

- `src/lib/zammad/client.ts`
- `src/lib/ticket/agent-helpers.ts`
- `src/app/api/staff/available/route.ts`
- `src/app/api/staff/vacation/route.ts`

这意味着“坐席可用性”不是一个纯本地状态模型。

---

## Webhook 集成

Webhook 入口：

- `POST /api/webhooks/zammad`
- 实现：`src/app/api/webhooks/zammad/route.ts`

当前行为：

- 若配置了 `ZAMMAD_WEBHOOK_SECRET`，则进行 HMAC 签名校验
- 解析 ticket / article payload
- 推断事件类型：`created` / `article_created` / `assigned` / `status_changed`
- 写入本地 `TicketUpdate`
- 最佳努力创建持久化通知
- 定向广播 SSE
- 在需要时触发邮件路由 / welcome flow 等旁路逻辑

这个 webhook 是外部 Zammad 事件与平台实时体验之间的桥梁。

---

## 实时更新边界

当前“实时更新”并不是 Zammad 直接把消息推给前端。

现在的路径是：

1. Zammad webhook
2. 本地写入 `TicketUpdate`
3. 本地通知副作用
4. 通过 `src/lib/sse/emitter.ts` 推送 SSE
5. 通过 `GET /api/tickets/updates` 做 polling fallback

关键文件：

- `src/app/api/webhooks/zammad/route.ts`
- `src/app/api/tickets/updates/stream/route.ts`
- `src/app/api/tickets/updates/route.ts`
- `src/lib/sse/emitter.ts`

---

## 附件处理

Zammad 相关附件链路需要分清两类：

### Zammad upload cache

- 路由：`src/app/api/attachments/upload/route.ts`
- 用于为 ticket / article 创建准备 Zammad 可引用的附件缓存

### Zammad article attachment download

- 路由：`src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`
- 会先读取 article，再根据附件元数据从 Zammad 下载

不要把这两条链路和 `src/app/api/files/*` 的本地文件元数据链路混为一谈。

---

## 健康检查与失败处理

相关健康处理在：

- `src/lib/zammad/health-check.ts`
- `src/app/api/health/zammad/route.ts`

依赖 Zammad 的平台 API 在 Zammad 不可用时，通常会返回更友好的错误或提前终止流程。

---

## 文档注意事项

仓库里仍有一些历史文档会提到：

- 用 Zammad KB 做 FAQ
- 更旧的分配策略
- 过期的路由数量
- 更旧的 auth / session 假设

除非代码当前仍支持，否则都应视为历史说明。

---

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AUTHENTICATION.md](./AUTHENTICATION.md)
- [API-REFERENCE.md](./API-REFERENCE.md)
- [DATABASE.md](./DATABASE.md)
