# 站内通知系统规范

## ADDED Requirements

### Requirement: 通知数据模型

系统 SHALL 提供持久化的通知存储。

#### Scenario: 通知创建
- **GIVEN** 发生需要通知用户的事件
- **WHEN** 系统创建通知
- **THEN** 通知 SHALL 包含: userId, type, title, body, data, read, createdAt
- **AND** 通知 SHALL 存储在数据库中

#### Scenario: 通知关联数据
- **GIVEN** 通知与特定资源相关 (如工单)
- **WHEN** 创建通知
- **THEN** data 字段 SHALL 包含资源标识 (如 ticketId)
- **AND** data 字段 SHALL 包含点击跳转链接 (link)

---

### Requirement: 通知类型

系统 SHALL 支持多种通知类型。

#### Scenario: 工单回复通知
- **GIVEN** 用户的工单收到新回复
- **WHEN** 系统处理 Webhook 事件
- **THEN** 系统 SHALL 创建 `ticket_reply` 类型通知
- **AND** 通知接收者 SHALL 是工单所有者 (customer) 或分配的 staff

#### Scenario: 工单分配通知
- **GIVEN** 工单被分配给 Staff
- **WHEN** 分配操作完成
- **THEN** 系统 SHALL 创建 `ticket_assigned` 类型通知
- **AND** 通知接收者 SHALL 是被分配的 Staff

#### Scenario: 工单状态变更通知
- **GIVEN** 工单状态发生变化
- **WHEN** 状态变更完成
- **THEN** 系统 SHALL 创建 `ticket_status` 类型通知
- **AND** 通知接收者 SHALL 是工单相关方

#### Scenario: 工单关闭通知
- **GIVEN** 工单状态变更为 closed
- **WHEN** 状态变更完成
- **THEN** 系统 SHALL 创建 `ticket_closed` 类型通知
- **AND** 通知接收者 SHALL 包含工单客户与当前处理 Staff

#### Scenario: 工单重新打开通知
- **GIVEN** 已关闭工单被重新打开
- **WHEN** 重新打开操作完成（如 PUT /api/tickets/{id}/reopen）
- **THEN** 系统 SHALL 创建 `ticket_reopened` 类型通知
- **AND** 通知接收者 SHALL 是工单相关方（例如：当前处理 Staff 与工单客户）

#### Scenario: 工单重新分配/取消分配通知
- **GIVEN** 工单 owner 发生变化导致某位 Staff 不再负责该工单
- **WHEN** 分配变更完成
- **THEN** 系统 SHALL 创建 `ticket_unassigned` 类型通知
- **AND** 通知接收者 SHALL 是原 owner Staff

#### Scenario: 工单评分通知
- **GIVEN** 客户对工单提交评分
- **WHEN** 评分保存成功（如 POST /api/tickets/{id}/rating）
- **THEN** 系统 SHALL 创建 `ticket_rated` 类型通知
- **AND** 通知接收者 SHALL 包含当前处理 Staff
- **AND** 当评分为 negative 时系统 SHOULD 额外通知所有 Admin

#### Scenario: 自动分配失败告警
- **GIVEN** 自动分配运行后仍存在未能分配的工单
- **WHEN** 系统生成运行结果（如 POST /api/tickets/auto-assign）
- **THEN** 系统 SHALL 创建 `system_alert` 类型通知
- **AND** data SHALL 包含失败原因与受影响的工单编号/链接
- **AND** 通知接收者 SHALL 是所有 Admin

#### Scenario: 用户角色变更通知
- **GIVEN** Admin 修改用户角色
- **WHEN** 角色更新成功（如 PUT /api/admin/users/{id}/role）
- **THEN** 系统 SHALL 创建 `account_role_changed` 类型通知
- **AND** 通知接收者 SHALL 是被修改的用户

#### Scenario: 用户状态变更通知
- **GIVEN** Admin 激活或禁用用户
- **WHEN** 状态更新成功（如 PATCH /api/admin/users/{id}/status）
- **THEN** 系统 SHALL 创建 `account_status_changed` 类型通知
- **AND** 通知接收者 SHALL 是被修改的用户

#### Scenario: 新工单通知
- **GIVEN** 客户创建新工单
- **WHEN** 工单创建成功
- **THEN** 系统 SHALL 创建 `ticket_created` 类型通知
- **AND** 通知接收者 SHALL 是所有 Admin

---

### Requirement: 通知 API

系统 SHALL 提供通知管理 API。

#### Scenario: 获取通知列表
- **GIVEN** 用户已登录
- **WHEN** 请求 GET /api/notifications
- **THEN** 系统 SHALL 返回该用户的通知列表
- **AND** 默认按 createdAt 降序排列
- **AND** 支持 limit, offset, unread 查询参数

#### Scenario: 获取未读数量
- **GIVEN** 用户已登录
- **WHEN** 请求 GET /api/notifications/unread-count
- **THEN** 系统 SHALL 返回该用户未读通知数量

#### Scenario: 标记单个已读
- **GIVEN** 用户拥有该通知
- **WHEN** 请求 PUT /api/notifications/{id}/read
- **THEN** 系统 SHALL 将该通知标记为已读
- **AND** 设置 readAt 时间戳

#### Scenario: 标记全部已读
- **GIVEN** 用户已登录
- **WHEN** 请求 PUT /api/notifications/read-all
- **THEN** 系统 SHALL 将该用户所有未读通知标记为已读

#### Scenario: 删除通知
- **GIVEN** 用户拥有该通知
- **WHEN** 请求 DELETE /api/notifications/{id}
- **THEN** 系统 SHALL 删除该通知

---

### Requirement: 通知权限

系统 SHALL 确保通知隔离。

#### Scenario: 只能访问自己的通知
- **GIVEN** 用户 A 请求用户 B 的通知
- **WHEN** 请求处理
- **THEN** 系统 SHALL 返回 403 Forbidden (staff/admin) 或 404 Not Found (customer)

#### Scenario: Admin 不能查看其他用户通知
- **GIVEN** Admin 请求查看其他用户通知
- **WHEN** 请求处理
- **THEN** 系统 SHALL 拒绝访问
- **AND** 通知是用户私有数据

---

### Requirement: 通知中心 UI

系统 SHALL 提供统一的通知中心界面。

#### Scenario: 导航栏通知入口
- **GIVEN** 用户已登录
- **WHEN** 查看任意页面
- **THEN** 导航栏 SHALL 显示通知铃铛图标
- **AND** 有未读通知时 SHALL 显示红色 Badge

#### Scenario: 通知下拉面板
- **GIVEN** 用户点击通知铃铛
- **WHEN** 面板展开
- **THEN** SHALL 显示最近通知列表
- **AND** SHALL 区分已读/未读状态
- **AND** SHALL 提供「全部已读」按钮

#### Scenario: 通知点击跳转
- **GIVEN** 用户点击某条通知
- **WHEN** 通知包含 link 数据
- **THEN** 系统 SHALL 跳转到对应页面
- **AND** 系统 SHALL 自动标记该通知为已读

#### Scenario: 未读数量显示
- **GIVEN** 用户有未读通知
- **WHEN** 未读数量大于 99
- **THEN** Badge SHALL 显示 "99+"
- **WHEN** 未读数量为 0
- **THEN** Badge SHALL 隐藏

---

### Requirement: 实时通知推送

系统 SHALL 支持实时通知更新。

#### Scenario: 新通知实时显示
- **GIVEN** 用户正在使用系统
- **WHEN** 有新通知产生
- **THEN** 系统 SHALL 在 30 秒内更新通知列表
- **AND** 系统 SHALL 更新未读 Badge

#### Scenario: 页面可见性优化
- **GIVEN** 用户切换到其他标签页
- **WHEN** 页面不可见
- **THEN** 系统 SHALL 暂停轮询
- **WHEN** 页面重新可见
- **THEN** 系统 SHALL 立即刷新通知

---

### Requirement: 与现有未读系统集成

系统 SHALL 平滑迁移现有未读工单功能。

#### Scenario: 未读工单转通知
- **GIVEN** 现有 unread-store 正在使用
- **WHEN** 新通知系统上线
- **THEN** 工单相关未读状态 SHALL 从 Notification 表读取
- **AND** 导航栏 Badge SHALL 显示通知未读数

#### Scenario: 工单详情页标记已读
- **GIVEN** 用户进入工单详情页
- **WHEN** 该工单有未读通知
- **THEN** 系统 SHALL 标记相关通知为已读

---

### Requirement: 通知保留策略

系统 SHALL 管理通知生命周期。

#### Scenario: 自动清理过期通知
- **GIVEN** 通知已超过保留期 (默认 90 天)
- **WHEN** 清理任务执行
- **THEN** 系统 SHALL 删除过期已读通知
- **AND** 保留未读通知直到用户阅读

#### Scenario: 可配置保留期
- **GIVEN** 环境变量 NOTIFICATION_RETENTION_DAYS 设置
- **WHEN** 清理任务执行
- **THEN** 系统 SHALL 使用配置的保留天数

---

## 通知类型参考

| 类型 | 触发条件 | 接收者 | 优先级 |
|------|----------|--------|--------|
| ticket_reply | 工单新回复 | 工单 owner/assignee | P0 |
| ticket_assigned | 工单分配 | 被分配的 Staff | P0 |
| ticket_status | 状态变更 | 工单相关方 | P1 |
| ticket_created | 新工单 | Admin | P1 |
| ticket_closed | 工单关闭 | 工单客户与当前处理 Staff | P1 |
| ticket_reopened | 工单重新打开 | 工单相关方 | P1 |
| ticket_unassigned | 工单取消分配/被改派 | 原 owner Staff | P2 |
| ticket_rated | 工单评分提交 | 当前处理 Staff / (negative 时 Admin) | P2 |
| system_alert | 系统异常 | Admin | P0 |
| mention | @ 提及 | 被提及用户 | P2 |
| account_role_changed | 用户角色变更 | 被修改用户 | P1 |
| account_status_changed | 用户状态变更 | 被修改用户 | P1 |

---

## 错误码

| 错误码 | HTTP 状态 | 描述 |
|--------|-----------|------|
| NOTIFICATION_NOT_FOUND | 404 | 通知不存在或无权访问 |
| UNAUTHORIZED | 401 | 未登录 |
| FORBIDDEN | 403 | 无权访问他人通知 |
