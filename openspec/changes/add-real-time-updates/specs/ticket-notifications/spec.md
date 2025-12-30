# 工单通知系统规范

## ADDED Requirements

### Requirement: 工单更新通知
系统 SHALL 在工单发生以下变化时通知相关用户：
- 新消息/回复
- 状态变化
- 分配变化

#### Scenario: Staff 收到新消息通知
- **WHEN** 客户在工单中发送新消息
- **THEN** 分配给该工单的 Staff 应在 30 秒内收到 Toast 通知
- **AND** 工单在列表中显示未读高亮

#### Scenario: 页面不可见时暂停通知检查
- **WHEN** 用户切换到其他标签页
- **THEN** 系统应暂停轮询以节省资源
- **AND** 用户返回时恢复轮询

### Requirement: 未读状态管理
系统 SHALL 跟踪每个用户的未读工单状态，并在本地持久化。

#### Scenario: 标记工单为已读
- **WHEN** 用户进入工单详情页
- **THEN** 该工单应自动标记为已读
- **AND** 未读高亮消失

#### Scenario: 未读状态持久化
- **WHEN** 用户刷新页面
- **THEN** 之前的未读状态应保留
- **AND** 通过 localStorage 恢复

### Requirement: 工单列表未读高亮
系统 SHALL 在工单列表中高亮显示未读工单。

#### Scenario: 未读工单视觉区分
- **WHEN** 工单有未读消息
- **THEN** 工单应显示蓝色左边框
- **AND** 标题加粗
- **AND** 显示未读消息数 Badge

### Requirement: Webhook 更新接收
系统 SHALL 接收并处理来自 Zammad 的 Webhook 通知。

#### Scenario: 接收工单更新 Webhook
- **WHEN** Zammad 发送工单更新 Webhook
- **THEN** 系统应验证签名
- **AND** 将更新写入 TicketUpdate 数据库表
- **AND** 返回 200 状态码

#### Scenario: Webhook 签名验证失败
- **WHEN** Webhook 请求签名无效
- **THEN** 系统应返回 401 状态码
- **AND** 记录错误日志
