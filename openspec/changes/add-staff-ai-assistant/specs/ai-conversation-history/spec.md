## ADDED Requirements
### Requirement: Staff AI 助手入口
系统 SHALL 允许 staff 从 staff 侧边栏直接进入个人 AI 助手，并复用按认证用户 ID 隔离的 AI 会话能力。

#### Scenario: staff 从侧边栏进入 AI 助手
- **GIVEN** 当前用户角色为 `staff`
- **WHEN** 用户点击 staff 侧边栏的 AI 助手入口
- **THEN** 系统 SHALL 导航到 `/staff/conversations`
- **AND** 系统 SHALL 在 staff 布局内显示 AI 助手

#### Scenario: staff 进入 AI 助手入口
- **GIVEN** 当前用户角色为 `staff`
- **WHEN** 用户打开 `/staff/conversations`
- **THEN** 系统 SHALL 跳转到 `/staff/conversations/new`
- **AND** 系统 SHALL NOT 在跳转前请求历史会话列表

#### Scenario: staff 发送第一条 AI 消息
- **GIVEN** 当前用户角色为 `staff`
- **AND** 用户位于 `/staff/conversations/new`
- **WHEN** 用户发送第一条消息
- **THEN** 系统 SHALL 为该 staff 用户创建个人 AI 会话
- **AND** 系统 SHALL 将地址替换为 `/staff/conversations/{conversationId}`
- **AND** 系统 SHALL NOT 导航到 customer 路由

#### Scenario: staff 打开历史记录
- **GIVEN** 当前用户角色为 `staff`
- **WHEN** 用户在 staff AI 助手中打开历史记录
- **THEN** 系统 SHALL 只请求该 staff 用户自己的 AI 会话历史
- **AND** 系统 SHALL NOT 返回其他用户的 AI 会话历史
