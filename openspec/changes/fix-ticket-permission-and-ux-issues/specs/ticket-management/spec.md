# 工单管理功能

## ADDED Requirements

### Requirement: Admin 删除工单

Admin 用户 SHALL 能够删除工单。

#### Scenario: Admin 成功删除工单
- **GIVEN** 用户角色为 Admin
- **AND** 目标工单存在
- **WHEN** 用户点击删除按钮并确认
- **THEN** 系统 SHALL 调用 DELETE API
- **AND** 系统 SHALL 显示删除成功提示
- **AND** 工单 SHALL 从列表中移除

#### Scenario: 非 Admin 无法删除工单
- **GIVEN** 用户角色为 Staff 或 Customer
- **WHEN** 用户尝试删除工单
- **THEN** 系统 SHALL 返回 403 Forbidden 错误

### Requirement: 客户关闭工单

客户 SHALL 能够主动关闭自己的工单。

#### Scenario: 客户成功关闭工单
- **GIVEN** 用户角色为 Customer
- **AND** 目标工单由该客户创建
- **AND** 工单状态不是已关闭
- **WHEN** 用户点击"关闭工单"按钮
- **THEN** 系统 SHALL 显示确认对话框
- **WHEN** 用户确认关闭
- **THEN** 系统 SHALL 将工单状态更新为 closed
- **AND** 系统 SHALL 显示关闭成功提示

#### Scenario: 客户无法关闭他人工单
- **GIVEN** 用户角色为 Customer
- **AND** 目标工单不是由该客户创建
- **WHEN** 用户尝试关闭该工单
- **THEN** 系统 SHALL 返回 403 Forbidden 错误

### Requirement: Live 聊天附件发送

用户 SHALL 能够在 Live 聊天中发送附件。

#### Scenario: 成功发送附件
- **GIVEN** 用户在 Live 聊天界面
- **WHEN** 用户选择附件并点击发送
- **THEN** 系统 SHALL 上传附件
- **AND** 系统 SHALL 在聊天中显示附件
- **AND** 对方 SHALL 能够接收并查看附件

#### Scenario: 附件格式限制
- **GIVEN** 用户尝试上传附件
- **WHEN** 附件格式不支持或大小超限
- **THEN** 系统 SHALL 显示错误提示
- **AND** 系统 SHALL 不发送该附件

### Requirement: 无区域工单手工处理

系统 SHALL 确保无法解析区域的工单不进入自动分配流程。

#### Scenario: 无区域工单不进入自动分配
- **GIVEN** 工单无法解析区域（`group_id` 为空或不在映射表中）
- **AND** 工单 note 中不存在有效的 `Region:` 标记
- **WHEN** 自动分配流程执行
- **THEN** 系统 SHALL 不为该工单分配 `owner_id`
- **AND** 该工单 SHALL 仅由 Admin 手工处理
