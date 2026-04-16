## MODIFIED Requirements

### Requirement: 未知区域工单边界

系统 SHALL 以分组与归属状态而不是 `note.Region` 解析结果定义未路由工单边界。

#### Scenario: 未分组或负责人不可用的工单仅由 Admin 处理

- **GIVEN** 工单对应客户未分组，或其服务分组负责人不可用
- **WHEN** 该工单处于暂存或未分配状态
- **THEN** 系统 SHALL 仅允许 Admin 看到该工单用于手动处理

#### Scenario: Customer 仍然可以看到自己的工单

- **GIVEN** 用户角色为 Customer
- **WHEN** 用户访问自己创建的工单
- **THEN** 系统 SHALL 继续按 `customer_id` 进行隔离
- **AND** 工单所在 Group 是否已迁移 SHALL NOT 影响该客户查看自己的工单

### Requirement: 工单分配规则

系统 SHALL 以 service-group assignment 驱动默认工单归属行为。

#### Scenario: 直接单工单改派只影响当前工单

- **GIVEN** Admin 在工单详情中修改单个工单的 assignee
- **WHEN** 改派成功
- **THEN** 系统 SHALL 只修改当前工单的 assignee
- **AND** 系统 SHALL NOT 隐式修改该客户的 `CustomerGroupAssignment`

#### Scenario: 系统不再使用最小组回退分配

- **GIVEN** Admin 发起直接分配操作
- **WHEN** 目标服务分组不可解析或负责人不可用
- **THEN** 系统 SHALL 返回明确失败或保持工单待处理
- **AND** 系统 SHALL NOT 回退到“最小 staff group”选择逻辑
