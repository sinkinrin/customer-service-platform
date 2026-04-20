# 工单生命周期与 `note.region` 废弃重构设计

> 日期：2026-04-16
> 状态：Draft
> 主题：记录当前以 Zammad `note` 中 `Region:` 为客户区域真相的工单生命周期，并定义废弃 `note.region` 后的目标生命周期与重构边界

---

## 1. 背景与目标

当前系统中，客户的业务区域主要来自 Zammad 用户 `note` 字段中的：

```text
Region: asia-pacific
```

这个设计在项目早期是一个低成本方案：

- 不需要本地数据库建模即可给 customer 绑定区域
- customer 登录后可以直接从 Zammad 用户对象解析区域
- 邮件工单 webhook 可以只依赖 `ticket.customer_id -> getUser(note)` 完成路由
- Admin 创建、导入、编辑用户时，只需把区域写回 Zammad `note`

但在引入 `ServiceGroup + CustomerGroupAssignment` 之后，这种做法已经开始成为架构阻力。原因不是 `note` 这个字段本身有问题，而是“把客户归属真相放在自由文本字段中”会导致：

- 网页建单、邮件建单、登录显示、后台编辑之间的真相分叉
- 无法自然表达“客户属于服务分组，而不是直接属于 region”
- 无法稳定支持“客户改分组”“服务分组换负责人”“批量迁移未关闭工单”等管理动作
- 欢迎流程和路由流程耦合在同一个 `note` 文本中

本文档目标：

1. 记录当前系统中工单从创建、分配、对话到状态变化的真实生命周期
2. 逐段标明 `note.region` 在当前生命周期中的参与方式
3. 定义废弃 `note.region` 后的目标生命周期
4. 明确涉及文件、项目架构边界、保留/重写/废弃的模块
5. 识别重构中的关键风险与迁移重点

---

## 2. 当前架构总览

### 2.1 核心参与系统

- Web 平台
  - 登录、后台、客户建单、Staff/Admin 回复、前端通知
- Zammad
  - 用户、工单、文章（article）、group、webhook
- Prisma / 本地数据库
  - `TicketUpdate`
  - `Notification`
  - `CustomerStaffBinding`
  - 其他辅助数据
- SSE / Polling
  - 将 Zammad webhook 产生的工单更新推送回前端

### 2.2 当前“区域与归属”的真实来源

#### Staff / Admin

- 权限与可见范围主要来自 Zammad `group_ids`
- 在登录态中，代码通常把某个 `full` 权限 group 反推为 `user.region`

#### Customer

- 区域主要来自 Zammad 用户 `note` 中的 `Region: xxx`
- 登录后 `session.user.region` 由 `note` 解析得出
- 邮件工单 routing 也直接依赖这个 `note` 字段

#### 默认负责人

- 默认负责人不是从 `note` 中得到
- 当前默认负责人来自本地 `CustomerStaffBinding`
- 如果不存在 binding，则走 group 内负载均衡

### 2.3 当前关键模型与模块

| 领域 | 当前实现 |
|------|------|
| 区域常量与 group 映射 | `src/lib/constants/regions.ts` |
| customer 登录时 region 解析 | `src/auth.ts` |
| Admin 用户列表/详情/编辑中的 customer region | `src/app/api/admin/users/route.ts` / `src/app/api/admin/users/[id]/route.ts` |
| 网页建单主入口 | `src/app/api/tickets/route.ts` |
| 邮件建单后路由 | `src/lib/ticket/email-ticket-routing.ts` |
| 自动分配 | `src/lib/ticket/auto-assign.ts` |
| 旧客户固定负责人 | `src/lib/ticket/customer-binding.ts` |
| 单工单手动分配 | `src/app/api/tickets/[id]/assign/route.ts` |
| 工单对话（article） | `src/app/api/tickets/[id]/articles/route.ts` |
| webhook、SSE、轮询更新 | `src/app/api/webhooks/zammad/route.ts` / `src/app/api/tickets/updates/route.ts` |
| 首次 email 用户欢迎流程 | `src/lib/ticket/email-user-welcome.ts` |

---

## 3. 当前生命周期：废弃 `note.region` 前

本节按真实运行链路拆分，不按“概念模型”描述。

---

## 4. 当前生命周期 A：登录与会话准备

### 4.1 登录入口

关键文件：

- `src/auth.ts`

### 4.2 当前逻辑

1. 用户通过 Zammad 认证
2. 系统得到 Zammad 用户对象
3. 角色从 `role_ids` 映射
4. 区域按角色分别计算

#### Staff / Admin

- 从 `group_ids` 中找 `full` 权限 group
- 再反推为 `region`

#### Customer

- 从 `note` 中解析 `Region: xxx`

### 4.3 当前状态产物

登录完成后，`Session.user` 中会得到：

- `role`
- `zammad_id`
- `group_ids`
- `region`

其中 customer 的 `region` 本质上是：

```text
session.user.region = parse(zammadUser.note)
```

### 4.4 当前问题

- customer 的区域真相是弱结构文本
- 未分组客户在现模型里几乎没有一等公民地位
- 如果未来客户归属改成 `ServiceGroup`，登录态里的 `user.region` 将不再适合作为主来源

---

## 5. 当前生命周期 B：Web 建单

### 5.1 入口

关键文件：

- `src/app/api/tickets/route.ts`
- `src/lib/zammad/ensure-user.ts`
- `src/lib/ticket/auto-assign.ts`

### 5.2 当前处理流程

1. `POST /api/tickets`
2. 解析 body 与校验参数
3. 解析建单目标 region
4. 检查用户是否有权在该 region 建单
5. `ensureZammadUser`
6. `region -> group_id`
7. 在 Zammad 创建 ticket
8. 触发 `autoAssignSingleTicket`
9. 异步通知

### 5.3 当前关键决策点

当前建单目标 region 解析方式：

```text
ticketData.region || user.region || 'asia-pacific'
```

对 customer 来说：

- `user.region` 来源于 `note.region`

因此当前 web 建单实际上间接依赖了 `note.region`。

### 5.4 当前自动分配策略

`autoAssignSingleTicket` 采用：

1. 查 `CustomerStaffBinding`
2. 有绑定则优先分给绑定 staff
3. staff 休假时尝试 replacement
4. 不可用则退化到 group 内负载均衡
5. 首次成功分单还会自动创建 binding

### 5.5 当前生命周期结果

#### 成功

- ticket 创建在目标区域组
- owner 被指定为某个 staff
- ticket 状态通常从 `new -> open`

#### 失败

- ticket 仍然留在目标区域组
- 只是没有 owner
- Admin 收到“自动分配失败”通知

### 5.6 当前问题

当前 web 建单失败时不会进入 staging，而是留在区域组里未分配。  
这和你后续确认的“负责人不可用或客户未分组时进入待分配池”目标并不一致。

---

## 6. 当前生命周期 C：Email 建单

### 6.1 入口

关键文件：

- `src/app/api/webhooks/zammad/route.ts`
- `src/lib/ticket/email-ticket-routing.ts`
- `src/lib/ticket/email-user-welcome.ts`

### 6.2 当前处理流程

1. 客户通过邮件发起支持请求
2. Zammad 自动创建 ticket
3. ticket 初始进入 `STAGING_GROUP_ID = 9`
4. Zammad webhook 调用平台
5. 平台把 webhook 事件写入 `TicketUpdate`
6. webhook 异步触发 `handleEmailTicketRoutingFromWebhookPayload`
7. 系统用 `ticket.customer_id` 获取 Zammad customer
8. 从 `customer.note` 解析 `Region: xxx`
9. 如果 region 有效，则把 ticket 从 staging 移到区域组
10. 然后调用 `autoAssignSingleTicket`
11. 如果 region 缺失或无效，则 ticket 留在 staging，通知 Admin

### 6.3 与 web 建单的关键差异

email 建单当前是“两段式”：

- 第 1 段：先由 Zammad 建到 staging
- 第 2 段：平台再根据 `note.region` 路由到目标区域组

而 web 建单是“直接建到区域组”。

### 6.4 当前 `note.region` 在 email 链路中的作用

这是当前系统里 `note.region` 的最强依赖点：

- 它不是展示字段
- 不是兼容字段
- 而是**邮件工单路由真相**

如果 `note` 没有有效 region：

- ticket 不会进入正式处理组
- ticket 会停留在 staging

### 6.5 当前问题

- email 工单主路由依赖自由文本字段
- 一旦 `note` 更新滞后或值错误，邮件建单会被错误路由
- `note` 文本一旦承载更多业务标记，结构会越来越脆弱

---

## 7. 当前生命周期 D：首次 Email 用户欢迎流程

### 7.1 入口

关键文件：

- `src/lib/ticket/email-user-welcome.ts`

### 7.2 当前处理逻辑

欢迎流程当前把：

```text
note 中没有 Region:
```

当成“首次 email 用户”的判断条件。

流程如下：

1. webhook 收到 email 创建事件
2. 获取 customer 用户对象
3. 调用 `isFirstTimeEmailUser(note)`
4. 其内部实际逻辑是：
   - `parseRegionFromNote(note)`
   - 没有有效 region 就认为是首次 email 用户
5. 对首次用户：
   - 自动生成密码
   - 回写 `WelcomePasswordSet:`
   - 发送欢迎邮件
   - 回写 `WelcomeEmailSent:`

### 7.3 当前架构问题

这是一个非常关键的隐藏耦合：

- welcome 状态与 routing 状态共用同一个 `note`
- “有没有 region”既影响工单 routing，又影响 onboarding 判断

如果未来只移除 `note.region`，却不重写欢迎流程，那么所有 email 用户都会被误判为“首次 email 用户”。

---

## 8. 当前生命周期 E：工单对话（Article）

### 8.1 入口

关键文件：

- `src/app/api/tickets/[id]/articles/route.ts`
- `src/app/api/tickets/[id]/route.ts`

### 8.2 当前查看对话流程

1. `GET /api/tickets/[id]/articles`
2. 先取 ticket 本体
3. 校验当前用户是否有权访问该 ticket
4. 再从 Zammad 取该 ticket 的所有 articles

### 8.3 当前回复对话流程

1. `POST /api/tickets/[id]/articles`
2. 校验 ticket 访问权限
3. 校验 article 类型、body、附件等参数
4. 调用 Zammad `createArticle`

### 8.4 权限逻辑

#### Customer

- 只能访问自己的 ticket
- 使用 `X-On-Behalf-Of`
- 不能发送 `email` 类型 article
- 不能指定 `to/cc`

#### Staff

- 只能访问自己可见 group 范围内的 ticket

#### Admin

- 全量可见
- 可直接回复、改分配、改状态

### 8.5 当前 `note.region` 在对话链路中的地位

几乎不直接参与。

对话链路真正依赖的是：

- ticket 的 `customer_id`
- ticket 的 `group_id`
- ticket 的 `owner_id`
- 当前登录用户的权限

因此 `note.region` 废弃后，“工单对话”层不是主要改动点。

---

## 9. 当前生命周期 F：手工分配、重分配、状态变化

### 9.1 单工单手工分配

关键文件：

- `src/app/api/tickets/[id]/assign/route.ts`

当前行为：

1. 仅 Admin 可调用
2. 可指定 `staff_id`
3. 也可显式指定 `group_id`
4. 如果不指定 `group_id` 且目标 staff 不具备当前 ticket 所在 group 权限，
   系统会自动把 ticket 移到该 staff 的“最小 group_id”对应组
5. 分配时 ticket 会自动从 `new -> open`

### 9.2 这个行为为何是未来风险

未来如果引入 `ServiceGroup.baseRegion`：

- 工单迁移目标组应由 `baseRegion` 明确决定
- 不能继续依赖“staff 最小 group”这种推断行为

否则一旦某个 staff 拥有多个 group 权限，迁移结果会不可预测。

### 9.3 状态变化与 reopen

关键文件：

- `src/app/api/tickets/[id]/route.ts`
- `src/app/api/tickets/[id]/reopen/route.ts`

当前系统支持：

- 更新 title / group / state / priority
- customer 关闭自己的工单
- staff/admin 重新打开工单
- reopen 时附加内部 note

这些流程不依赖 `note.region`，只依赖 ticket 本身。

---

## 10. 当前生命周期 G：Webhook、TicketUpdate、SSE、Polling

### 10.1 入口

关键文件：

- `src/app/api/webhooks/zammad/route.ts`
- `src/app/api/tickets/updates/route.ts`
- `src/lib/hooks/use-ticket-updates.ts`
- `src/lib/hooks/use-ticket-sse.ts`

### 10.2 当前处理流程

1. Zammad webhook 到达平台
2. 平台推断事件类型：
   - `created`
   - `article_created`
   - `assigned`
   - `status_changed`
3. 将事件写入 `TicketUpdate`
4. 通过 SSE 广播给前端
5. 通过通知系统生成站内通知
6. 前端通过 polling 或 SSE 刷新 ticket 列表/详情/对话视图

### 10.3 当前 `note.region` 在更新链路中的地位

不直接参与。

更新链路依赖的是：

- webhook payload 中的 ticket/article 字段
- owner/customer/group 元数据
- 本地 user mapping 与通知系统

因此这条链路在 `note.region` 重构后大多可以保留。

---

## 11. 当前生命周期总结

### 11.1 当前真实全景图

```text
Customer Login
  -> auth.ts
  -> customer region = parse(note.Region)

Web Ticket Creation
  -> POST /api/tickets
  -> resolve region from ticketData.region || user.region
  -> region -> group_id
  -> create Zammad ticket directly in regional group
  -> autoAssignSingleTicket
      -> CustomerStaffBinding first
      -> fallback load balance
      -> auto-create binding on first success

Email Ticket Creation
  -> Zammad creates ticket in staging group 9
  -> webhook
  -> email-ticket-routing
      -> get customer note
      -> parse note.Region
      -> move ticket to regional group
      -> autoAssignSingleTicket

Ticket Conversation
  -> GET/POST ticket articles
  -> Zammad articles
  -> webhook -> TicketUpdate -> SSE/Polling
```

### 11.2 当前最大结构问题

- customer region 真相在 `note`
- customer 默认负责人真相在 `CustomerStaffBinding`
- staff 可见范围真相在 `group_ids`
- web 与 email 入口行为不一致

这意味着当前系统的“路由与归属真相”是分散的。

---

## 12. 目标架构：废弃 `note.region` 后

### 12.1 核心决策

废弃 `note.region` 后，客户业务归属不再存放在 Zammad 用户自由文本里。

新的真相模型应为：

- `ServiceGroup`
  - `name`
  - `baseRegion`
  - `staffZammadId`
  - `isActive`
- `CustomerGroupAssignment`
  - `customerZammadId`
  - `serviceGroupId`
  - `assignedAt`

### 12.2 真相重组

#### Customer 业务归属

来自本地 DB：

```text
customer -> CustomerGroupAssignment -> ServiceGroup
```

#### Customer 有效区域

来自：

```text
ServiceGroup.baseRegion
```

#### Staff 可见范围

继续来自 Zammad `group_ids`

#### Ticket 状态与对话

继续由 Zammad 负责

### 12.3 `note` 的新地位

`note` 可被完全移出“客户 region 主流程”。

如果仍然保留 `note`：

- 只能作为兼容性或运营备注字段
- 不再参与客户路由主逻辑

---

## 13. 目标生命周期：登录

### 13.1 新流程

1. 用户通过 Zammad 认证
2. 得到 Zammad 用户对象与 `zammad_id`
3. 如果是 customer：
   - 不再从 `note` 解析 region
   - 改为查本地 `CustomerGroupAssignment`
   - 已分组则派生 `effectiveRegion = serviceGroup.baseRegion`
   - 未分组则 region 可为空
4. 如果是 staff/admin：
   - 仍然从 `group_ids` 派生权限范围

### 13.2 新收益

- customer 登录不再依赖弱结构文本
- 未分组客户成为系统内合法状态
- 登录态与工单路由真相保持一致

---

## 14. 目标生命周期：Web 建单

### 14.1 新流程

1. `POST /api/tickets`
2. 根据当前 customer 的 `zammad_id` 查 `CustomerGroupAssignment`
3. 分支处理

#### 情况 A：客户已分组，且负责人可用

```text
assignment -> serviceGroup
-> baseRegion -> group_id
-> staffZammadId -> owner_id
-> create ticket in regional group
-> assign to fixed owner
-> state new -> open
```

#### 情况 B：客户已分组，但负责人不可用

```text
create ticket in staging group 9
-> owner remains unassigned
-> notify admin
```

#### 情况 C：客户未分组

```text
create ticket in staging group 9
-> owner remains unassigned
-> notify admin
```

### 14.2 与当前逻辑的根本差异

当前逻辑是：

```text
region first
```

目标逻辑应改为：

```text
assignment first
```

---

## 15. 目标生命周期：Email 建单

### 15.1 新流程

1. Zammad 仍然先创建 email ticket 到 staging
2. webhook 触发
3. 平台读取 `ticket.customer_id`
4. 查本地 `CustomerGroupAssignment`
5. 分支处理

#### 情况 A：客户已分组，且负责人可用

```text
move ticket from staging -> baseRegion group
assign owner to serviceGroup.staffZammadId
state moves into normal processing flow
```

#### 情况 B：客户已分组，但负责人不可用

```text
ticket remains in staging
admin notified
```

#### 情况 C：客户未分组

```text
ticket remains in staging
admin notified
```

### 15.2 与当前逻辑的根本差异

当前 email 路由：

```text
customer.note.Region -> target region
```

目标 email 路由：

```text
customer assignment -> serviceGroup.baseRegion / serviceGroup.staffZammadId
```

---

## 16. 目标生命周期：工单对话与状态变化

### 16.1 对话层

目标状态下，以下部分原则上不需要重构其核心模式：

- `GET /api/tickets/[id]/articles`
- `POST /api/tickets/[id]/articles`
- Zammad article 存储
- webhook 触发的 `article_created`
- SSE / polling 前端更新

### 16.2 状态层

以下部分也可以保留主要模式：

- ticket close
- ticket reopen
- ticket status update
- `TicketUpdate` 存储与广播

### 16.3 原因

这些链路不依赖 customer 的 `note.region`，而依赖：

- ticket.customer_id
- ticket.owner_id
- ticket.group_id
- 当前登录用户的权限

所以真正要重构的是“前半段路由和归属”，不是“后半段工单对话与更新机制”。

---

## 17. 目标生命周期：Admin 操作

### 17.1 客户改服务分组

目标行为：

1. 更新 `CustomerGroupAssignment`
2. 查出该客户所有未关闭工单
3. 将这些工单迁移到：
   - 新 `owner_id`
   - 必要时新 `group_id`
4. 记录迁移结果

### 17.2 服务分组换负责人

目标行为：

1. 更新 `ServiceGroup.staffZammadId`
2. 查出该分组下所有客户
3. 聚合所有未关闭工单
4. 批量迁移：
   - `owner_id -> 新负责人`
   - 若 `baseRegion` 同时变更，则也改 `group_id`

### 17.3 单工单重分配

保持现有语义：

- 只影响当前 ticket
- 不影响客户默认归属
- 不影响服务分组负责人

---

## 18. 涉及文件与重构边界

### 18.1 可大体保留的模块

| 文件 | 原因 |
|------|------|
| `src/app/api/tickets/[id]/articles/route.ts` | 对话层不依赖 `note.region` |
| `src/app/api/tickets/[id]/route.ts` | 详情、状态更新、基础编辑不依赖 `note.region` 主逻辑 |
| `src/app/api/tickets/[id]/reopen/route.ts` | reopen 不依赖 customer note |
| `src/app/api/webhooks/zammad/route.ts` | `TicketUpdate`/通知/SSE 主框架可保留 |
| `src/app/api/tickets/updates/route.ts` | 更新轮询层可保留 |
| `src/lib/hooks/use-ticket-updates.ts` | 前端 polling 机制可保留 |
| `src/lib/hooks/use-ticket-sse.ts` | SSE 接收机制可保留 |

### 18.2 必须重写或显著修改的模块

| 文件 | 原因 |
|------|------|
| `src/auth.ts` | customer region 不应再来自 note |
| `src/app/api/tickets/route.ts` | web 建单入口要从 `assignment first` 出发 |
| `src/lib/ticket/auto-assign.ts` | 旧 binding-first / load-balance 策略要退出主流程 |
| `src/lib/ticket/email-ticket-routing.ts` | 不能再用 `note.region` 决定邮件路由 |
| `src/app/api/admin/users/route.ts` | customer region 不能再作为主业务字段读写 |
| `src/app/api/admin/users/[id]/route.ts` | customer region note 写回逻辑要退出 |
| `src/app/api/admin/users/import/route.ts` | 不应再为 customer 初始化 `Region: xxx` 作为业务真相 |
| `src/app/api/admin/users/export/route.ts` | export 的 customer region 来源要改 |
| `src/app/api/tickets/[id]/assign/route.ts` | 对服务分组迁移场景不能再用“staff 最小 group”推断 |

### 18.3 必须新增的模块

| 模块 | 用途 |
|------|------|
| `ServiceGroup` Prisma model | 服务分组实体 |
| `CustomerGroupAssignment` Prisma model | 客户当前归属 |
| Admin ServiceGroup CRUD API | 后台维护分组 |
| Customer assignment API | 在客户详情页分组 |
| 批量迁移服务 | 客户改分组 / 分组换负责人时迁移未关闭工单 |

### 18.4 必须退役的运行时来源

| 模块 | 原因 |
|------|------|
| `CustomerStaffBinding` 运行时读路径 | 与新模型冲突 |
| `note.region` 在 auth 中的真相地位 | 与 assignment 真相冲突 |
| `note.region` 在 email routing 中的真相地位 | 与 assignment 真相冲突 |

---

## 19. 关键迁移风险

### 19.1 最大隐藏风险：欢迎流程误判

`src/lib/ticket/email-user-welcome.ts` 当前把：

```text
没有 Region -> 首次 email 用户
```

作为判断依据。

如果废弃 `note.region` 却不重构这里：

- 现有 email 用户会被误判为首次用户
- 会出现重复发欢迎邮件、重复密码初始化等严重问题

### 19.2 Web / Email 入口不一致

当前：

- web 建单直接进区域组
- email 建单先进 staging

目标重构时如果不统一这两条链，会留下新的认知负担。

### 19.3 Staff 多 group 与单 region 假设冲突

当前系统里有些地方按 `group_ids` 工作，有些地方仍按单 `user.region` 工作。

如果未来 staff 支持多个基础区域，这部分权限模型必须继续收敛。

### 19.4 跨系统事务不可强一致

客户改分组、服务分组换负责人都涉及：

- 本地 DB 更新
- Zammad ticket 批量迁移

这不是单事务可完全包住的强一致操作。  
架构上应默认：

- 本地 DB 是归属真相
- Zammad 同步是后续动作
- 失败应可审计、可重试、可见

---

## 20. 推荐重构策略

### 20.1 总体策略

不要只做“删掉 note 解析”。  
应按“真相迁移”来做：

1. 新建 `ServiceGroup + CustomerGroupAssignment`
2. 让 routing 主链路先改读新模型
3. 停止 `CustomerStaffBinding` 参与运行时自动分配
4. 停止 `note.region` 参与 auth 与 email routing
5. 单独重写 email welcome 的首次用户识别逻辑

### 20.2 真相迁移原则

重构后应明确：

- customer 业务归属唯一真相在本地数据库
- customer 不再通过“编辑 region”完成归属变更
- region 对 customer 不再是独立可写业务字段
- region 只作为：
  - `ServiceGroup.baseRegion`
  - staff 的 Zammad group 权限

---

## 21. 本文档结论

### 21.1 当前系统

当前系统并不是单一生命周期，而是两条并行链路：

- web 建单：`note.region -> 区域组 -> binding/均衡分单`
- email 建单：`staging -> note.region 路由 -> binding/均衡分单`

而 `note.region` 同时承担：

- customer 登录态 region 真相
- email 工单路由真相
- email 首次用户欢迎流程的判断条件之一

### 21.2 目标系统

废弃 `note.region` 后，目标应变成：

- customer 归属真相：`CustomerGroupAssignment`
- customer 有效区域：`ServiceGroup.baseRegion`
- ticket routing 真相：本地 assignment
- ticket 对话与状态：继续由 Zammad 管理
- welcome 流程：从 routing 状态中解耦

### 21.3 最重要的重构判断

真正需要大改的是：

- 登录前半段归属解析
- 建单前半段路由与分配
- email routing
- welcome 首次用户识别

真正可以保留主架构的是：

- ticket article 对话
- webhook -> TicketUpdate -> SSE / polling
- ticket 详情、状态变化、reopen 等后半段生命周期

---

## 22. 后续文档建议

在本文档基础上，下一份实现计划文档应进一步拆成：

1. 数据模型设计
2. API 面设计
3. 迁移策略
4. 测试计划
5. 回滚方案

建议后续实现计划聚焦以下主题：

- `ServiceGroup` / `CustomerGroupAssignment` schema
- `POST /api/tickets` 重构
- email routing 重构
- email welcome 状态迁移
- Admin 客户详情页分组入口
- 批量迁移未关闭工单的服务层
