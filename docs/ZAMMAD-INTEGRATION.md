# Zammad 集成

> 当前 Zammad 集成边界、关键文件与真实链路说明。

**最后更新**：2026-04-20

---

## 总览

Zammad 是这个平台背后的外部工单系统。

当前职责边界是：

- **Zammad**：ticket、ticket article、group 路由、大量用户记录、out-of-office 元数据、附件缓存链路
- **平台**：UI、认证编排、站内通知、ticket rating、reply template、FAQ、AI 数据、TicketUpdate 持久化、服务分组与邮件 CC 分配

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

当前客户归属以 `CustomerGroupAssignment → ServiceGroup` 为准。

- 网页创建工单：按客户服务分组的区域和固定负责人创建。
- 新建邮件工单：仅处理待分配区（group 9）内、尚未分配且状态为 new/open 的工单。先根据客户服务分组确定目标区域，开启 CC 自动分配后，优先选择首封客户邮件 CC 中唯一符合条件的坐席；开关关闭或没有唯一匹配时使用服务分组固定负责人。
- CC 匹配：读取 Zammad `ticket_articles/by_ticket` 的第一篇文章，必须是本次回调对应的公开 Customer/email 消息。使用完整邮箱匹配（忽略大小写、去重），不以显示名、邮箱别名或正文匹配。目标必须是 active Agent、非管理员/系统账号、未休假，且有目标区域 group 的 `full` 权限。多人符合条件时回退固定负责人，不按顺序任取一人。带组名的 RFC 地址组、未加引号的注释、空收件项或其他无法完整解析的 CC 格式整体回退；不根据部分成功解析的地址推断唯一匹配，原始内容仍完整展示。
- 客户没有服务分组，或 CC 和固定负责人都不可用：保留待处理并通知管理员；不会根据抄送邮箱擅自改变客户区域或创建长期绑定。
- CC 仅决定这张新工单的初始负责人。管理员、技术支持在邮件消息上可看到原始抄送字符串，空值隐藏；后续邮件的 CC 只用于展示，不会重新分配。
- 定时/管理员批量自动分配：跳过待分配区，只处理区域内未分配的 new/open 工单，仍使用服务分组负责人。已通过 CC 分配的工单不会被批量流程重分配。管理员明确取消区域工单的分配后，后续批量分配恢复服务分组规则。
- 管理员单张改派继续生效；管理员更换客户服务分组或分组负责人时，现有未关闭工单迁移规则仍可覆盖 CC 的初始分配。

邮件路由写入前重新读取工单，避免过期 webhook 或解析期间发生的改派/迁移被覆盖；区域、负责人和状态在一次 Zammad 更新中写入，避免批量流程看到“已移出待分配区但还没有负责人”的中间状态。同进程回调串行处理，已完成回调重放会根据当前工单状态跳过。`SERVICE_GROUP_ASSIGNMENT_CUTOVER=true` 时暂停邮件路由。

CC 候选查询失败时继续采用既有的固定负责人回退策略，并记录日志。读取当前工单、首篇文章（含空列表）、客户、服务分组或固定负责人等完成路由所必需的依赖失败时，路由返回可重试结果，Webhook 返回 HTTP 503，并尽力通知管理员。Zammad 重试同一个原始事件后会重新读取当前状态；无服务分组、负责人不可用等明确业务结果仍保留待处理并通知管理员，正常确认回调。更新请求失败同样返回 503，但不盲目回滚；若远端已经成功，重试根据已分配状态跳过再次写入。持续失败或重试耗尽时仍需管理员处理。已核对 [Zammad 6.5.2 的 TriggerWebhookJob](https://github.com/zammad/zammad/blob/6.5.2/app/jobs/trigger_webhook_job.rb)：请求失败会触发最多 5 次总尝试（含首次），重试等待为执行次数 × 10 秒；重试时按原工单与文章重新生成载荷。

Webhook 在写入本次 TicketUpdate、广播 SSE 和创建事件通知之前尝试邮件路由。路由失败返回 503 的尝试不会产生这些事件副作用；原事件恢复后再写入，避免由失败重试新增重复事件。此调整不扩展为所有成功重复投递的全局幂等机制。

Webhook 入口会对邮件文章回调尝试路由，由原始首篇消息校验最终决定。邮件路由不再依赖工单与文章创建时间相差小于 5 秒；事件分类、通知及 welcome 流程仍沿用原有规则。

### CC 自动分配开关

`EMAIL_CC_AUTO_ASSIGN_ENABLED` 默认关闭，仅值为 `true` 时开启。管理员和技术支持的 CC 展示始终可用。

- 启用：在目标环境的服务端环境变量中配置 `EMAIL_CC_AUTO_ASSIGN_ENABLED=true`，重启应用进程使环境配置生效。
- 回退：设置为 `false` 或移除此变量并重启应用。后续初始路由恢复服务分组负责人，已分配工单不会被批量撤回。
- 不修改 Zammad 邮件渠道、触发器或数据库结构，不需要数据库迁移。
- `SERVICE_GROUP_ASSIGNMENT_CUTOVER` 仍用于暂停邮件路由等分配流程，不能替代只关闭 CC 决策的独立开关。
- 成功路由日志包含 `assignmentSource=email_cc` 或 `service_group`、工单和负责人 ID，供核对分配来源。

并发边界：Zammad 6.5.2 REST 更新没有条件式 owner 比较接口。写入前复查及进程内串行不能提供跨实例或外部 Zammad 管理操作的严格互斥；若管理操作恰好发生于最后一次读取与写入之间，仍取决于写入顺序。写入超时不盲目回滚，通知管理员核查远端结果。

相关实现：

- `src/lib/ticket/email-ticket-routing.ts`
- `src/lib/ticket/email-cc.ts`
- `src/lib/ticket/agent-helpers.ts`
- `src/app/api/tickets/auto-assign/route.ts`
- `src/lib/service-groups/ticket-migration-service.ts`

`autoAssignSingleTicket` 保留了无 customerId 时的负载均衡分支，但当前业务创建入口没有调用它，不能据此描述当前邮件或网页建单规则。

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
