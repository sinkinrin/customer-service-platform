# 工单权限系统

## ADDED Requirements

### Requirement: 统一权限过滤

系统 SHALL 提供统一的工单权限过滤机制，所有工单相关 API 必须使用该机制进行权限检查。

#### Scenario: Customer 只能查看自己的工单
- **GIVEN** 用户角色为 Customer
- **WHEN** 用户请求工单列表
- **THEN** 系统 SHALL 只返回 `customer_id` 等于当前用户 ID 的工单
- **AND** 当前用户 ID SHALL 以用户在 Zammad 中的 ID 为准（即 `session.user.zammad_id`）
- **AND** 系统 SHALL 不返回其他客户创建的工单

#### Scenario: Staff 只能查看分配给自己的工单
- **GIVEN** 用户角色为 Staff
- **WHEN** 用户请求工单列表
- **THEN** 系统 SHALL 返回 `owner_id` 等于当前用户 ID 的工单
- **AND** 当前用户 ID SHALL 以用户在 Zammad 中的 ID 为准（即 `session.user.zammad_id`）
- **AND** 系统 SHALL 不返回未分配的工单

#### Scenario: Staff 无法查看未分配工单
- **GIVEN** 用户角色为 Staff
- **AND** 存在未分配工单（`owner_id` 为空、0、或 1）
- **WHEN** 用户请求工单列表
- **THEN** 系统 SHALL 不返回该未分配工单

#### Scenario: Admin 可以查看所有工单
- **GIVEN** 用户角色为 Admin
- **WHEN** 用户请求工单列表
- **THEN** 系统 SHALL 返回所有工单（包括未分配工单）

### Requirement: 单工单权限检查

系统 SHALL 在访问单个工单详情时进行权限检查。

#### Scenario: Customer 访问他人工单被拒绝
- **GIVEN** 用户角色为 Customer
- **AND** 目标工单的 `customer_id` 不等于当前用户 ID
- **WHEN** 用户请求该工单详情
- **THEN** 系统 SHALL 返回 404 Not Found 错误

#### Scenario: Staff 访问非自己负责工单被拒绝
- **GIVEN** 用户角色为 Staff
- **AND** 目标工单的 `owner_id` 不等于当前用户 ID
- **WHEN** 用户请求该工单详情
- **THEN** 系统 SHALL 返回 403 Forbidden 错误

### Requirement: 未知区域工单边界

系统 SHALL 明确定义无法解析区域工单的可见性边界。

#### Scenario: 区域无法解析且未分配仅 Admin 可见
- **GIVEN** 工单无法解析区域（`group_id` 为空或不在映射表中）
- **AND** 工单 note 中不存在有效的 `Region:` 标记
- **AND** 工单为未分配（`owner_id` 为空、0、或 1）
- **WHEN** Staff 请求工单列表
- **THEN** 系统 SHALL 不返回该工单
- **WHEN** Admin 请求工单列表
- **THEN** 系统 SHALL 返回该工单

#### Scenario: 区域无法解析但已分配给 Staff 则该 Staff 可见
- **GIVEN** 工单无法解析区域（`group_id` 为空或不在映射表中）
- **AND** 工单 note 中不存在有效的 `Region:` 标记
- **AND** 工单已分配给当前 Staff（`owner_id` 等于当前用户 ID）
- **WHEN** Staff 请求工单列表
- **THEN** 系统 SHALL 返回该工单

### Requirement: 新工单默认未分配

系统 SHALL 确保新创建的工单默认处于未分配状态。

#### Scenario: 客户创建工单后保持未分配
- **GIVEN** 客户创建新工单
- **WHEN** 工单创建成功
- **THEN** 工单的 `owner_id` SHALL 为空
- **AND** 工单 SHALL 等待 Admin 手动分配

#### Scenario: 未分配工单仅 Admin 可见
- **GIVEN** 存在未分配工单
- **WHEN** Staff 请求工单列表
- **THEN** 该工单 SHALL 不出现在列表中
- **WHEN** Admin 请求工单列表
- **THEN** 该工单 SHALL 出现在列表中
