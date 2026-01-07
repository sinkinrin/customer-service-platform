# 架构 Review 与新方案（中文）

本文基于你的需求：
- 8 个大区；未分配工单对 staff 不可见。
- 工单主数据以 Zammad 为真源。
- 数据库设计重点解决权限与区域问题。
- 参考 Zammad API 文档的关键端点。

## 一、Zammad 关键端点与权限边界（参考）

来源：
- Tickets: https://docs.zammad.org/en/latest/api/ticket/index.html
- Articles & Attachments: https://docs.zammad.org/en/latest/api/ticket/articles.html
- Users: https://docs.zammad.org/en/latest/api/user.html
- Groups: https://docs.zammad.org/en/latest/api/group.html

核心端点：
- Tickets
  - `GET /api/v1/tickets`（ticket.agent 或 ticket.customer）
  - `GET /api/v1/tickets/{id}`（ticket.agent 或 ticket.customer）
  - `POST /api/v1/tickets`（ticket.agent 或 ticket.customer）
  - `PUT /api/v1/tickets/{id}`（ticket.agent 或 ticket.customer）
  - `DELETE /api/v1/tickets/{id}`（admin）
- Articles & Attachments
  - `GET /api/v1/ticket_articles/by_ticket/{ticket_id}`（ticket.agent 或 ticket.customer）
  - `GET /api/v1/ticket_articles/{article_id}`（ticket.agent 或 ticket.customer）
  - `POST /api/v1/ticket_articles`（ticket.agent 或 ticket.customer）
  - `GET /api/v1/ticket_attachment/{ticket_id}/{article_id}/{attachment_id}`
- Users
  - `GET /api/v1/users/me`（any）
  - `GET /api/v1/users`（ticket.agent 或 admin.user）
  - `GET /api/v1/users/{id}`（ticket.agent 或 admin.user 或 ticket.customer 且组织共享）
  - `POST /api/v1/users`（admin.user 或 ticket.agent）
  - `PUT /api/v1/users/{id}`（admin.user 或 ticket.agent）
- Groups
  - `GET /api/v1/groups`（admin.group）
  - `GET /api/v1/groups/{id}`（admin.group）
  - `POST /api/v1/groups`（admin.group）
  - `PUT /api/v1/groups/{id}`（admin.group）
  - `DELETE /api/v1/groups/{id}`（admin.group）

这些权限仅说明 Zammad 层能否访问，仍需要在你自己的系统内做“区域与未分配规则”的二次裁剪。

## 二、当前实现的架构 Review（问题清单）

### 1) 访问控制缺口
- `src/app/api/tickets/updates/route.ts`：仅校验登录，未按用户可见 ticket 过滤更新，导致跨区域/跨客户泄露。
- `src/app/api/tickets/[id]/rating/route.ts`：读写评分未验证 ticket 归属，任意登录用户可读写任意 ticketId。
- `src/app/api/files/[id]/route.ts` 与 `src/app/api/files/[id]/download/route.ts`：只校验登录，未校验文件 owner 或 reference 归属，存在下载越权。

### 2) 规则不一致
- `src/app/api/tickets/export/route.ts`：staff 只按区域过滤，未排除未分配工单；与“未分配仅 admin 可见”规则冲突。
- `src/app/api/tickets/[id]/articles/route.ts`：staff 仅按 group 校验、customer 另行校验，未统一到单一权限策略，容易与主规则偏离。

### 3) 本地表与权限边界未统一
- `TicketUpdate`、`TicketRating` 等本地表的访问未与 ticket 权限绑定，导致本地数据成为泄露面。

## 三、重新设计的架构方案（以需求为准，不依赖现有实现）

### 1) 分层与职责
- UI 层（Next.js）：只负责展示与调用 API，不做权限判断。
- API 层（业务入口）：统一鉴权与权限校验，所有业务入口都必须经过策略层。
- 权限策略层（Policy Engine）：单点定义“角色 + 区域 + 工单状态（未分配）”规则。
- Zammad 适配层：封装 Zammad API 调用（tickets、articles、attachments、users、groups）。
- 本地数据层：只保存辅助数据，所有访问都必须进行 ticket 级别的权限对齐。

### 2) 权限与区域核心规则（建议固定写入策略层）
- Admin：全量访问。
- Customer：仅允许访问 `ticket.customer_id == user.zammad_id` 的工单及其文章/附件/评分。
- Staff：
  - 仅可访问“已分配且 (owner_id == user.zammad_id 或 group_id 在所属区域组)”。
  - 未分配工单（owner_id 为空/0/1）对 staff 不可见。
- 区域：8 大区，group_id 与 region 一一映射；所有列表/搜索/导出以此过滤。

### 3) 关键 API 设计原则
- 所有 ticket 相关接口必须：
  - 拉取 Zammad ticket（或缓存视图）
  - 走策略层做 action 校验（view/edit/assign/close/delete）
- 本地表访问必须绑定 ticket 权限：
  - 更新推送（TicketUpdate）必须按可见 ticket 列表过滤。
  - 评分（TicketRating）读写必须确保 customer 拥有该票。
  - 文件（UploadedFile）必须校验 owner 或 reference 的 ticket 权限。

## 四、数据库设计（聚焦权限与区域）

说明：票务主数据不落库，Zammad 为真源；本地仅保存辅助与权限映射数据。

### 表：UserZammadMapping
- 用途：系统用户与 Zammad 用户绑定，避免频繁查找。
- 字段：userId(PK)、zammadUserId、zammadUserEmail、createdAt、updatedAt
- 约束：userId 唯一索引。

### 表：TicketRating
- 用途：客户评分。
- 字段：ticketId(PK/unique)、userId、rating(positive/negative)、reason、createdAt、updatedAt
- 约束：ticketId 唯一；userId 索引。
- 访问控制：必须验证 ticketId 对该 customer 可见。

### 表：TicketUpdate
- 用途：Zammad Webhook 落地事件，用于轮询提醒。
- 字段：id、ticketId、event、data(JSON)、createdAt
- 约束：ticketId 索引，createdAt 索引。
- 访问控制：返回时必须按 ticket 可见性过滤。

### 表：ReplyTemplate
- 用途：区域化模板。
- 字段：id、name、content、category、region、createdById、isActive、createdAt、updatedAt
- 约束：region 索引；category 索引。
- 访问控制：staff 仅能访问 region=自身或 region=NULL。

### 表：UploadedFile
- 用途：文件元信息。
- 字段：id、userId、referenceType(message/user_profile/ticket)、referenceId、bucketName、filePath、fileName、fileSize、mimeType、createdAt、updatedAt
- 访问控制：
  - referenceType=ticket 时，必须校验 ticket 可见性。
  - user_profile 时仅本人可访问。

## 五、与 Zammad 端点的结合方式（推荐）
- Tickets：
  - list/search：Zammad 返回后必须本地二次过滤（区域 + 未分配规则）。
  - detail/update：先取 ticket，再按策略判定。
- Articles：
  - list/create：必须先做 ticket 策略校验；customer 使用 X-On-Behalf-Of。
- Attachments：
  - 下载前必须做 ticket 策略校验（不只依赖 Zammad）。
- Users/Groups：
  - 仅 admin 或具备 Zammad 权限的服务账号调用，用于区域组与人员同步。

## 六、落地优先级（从风险最高开始）
1) 统一策略层：所有 ticket/本地数据访问都走同一套 action 规则。
2) 修复 updates/ratings/files 的越权访问。
3) 统一 list/search/export 的“未分配不可见”规则。
