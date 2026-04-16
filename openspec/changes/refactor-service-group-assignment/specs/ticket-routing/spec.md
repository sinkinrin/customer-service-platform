## MODIFIED Requirements

### Requirement: 邮件工单自动路由

系统 SHALL 基于 `CustomerGroupAssignment -> ServiceGroup` 处理邮件创建工单的自动路由。

#### Scenario: 已分组客户的邮件工单进入对应基础区域并分配负责人

- **GIVEN** 邮件工单先进入暂存 Group
- **AND** 客户存在 `CustomerGroupAssignment`
- **AND** 该分组负责人当前可用
- **WHEN** 系统处理该 created webhook
- **THEN** 系统 SHALL 将工单移动到该服务分组对应的基础区域 Group
- **AND** 系统 SHALL 将工单分配给该服务分组负责人

#### Scenario: 未分组客户的邮件工单留在暂存区

- **GIVEN** 邮件工单先进入暂存 Group
- **AND** 客户不存在 `CustomerGroupAssignment`
- **WHEN** 系统处理该 created webhook
- **THEN** 系统 SHALL 保持工单在暂存 Group
- **AND** 系统 SHALL 通知 Admin 手动处理

#### Scenario: 不再从客户 note 解析 Region

- **GIVEN** 客户 `note` 中存在或不存在 `Region:` 文本
- **WHEN** 系统处理邮件工单自动路由
- **THEN** 系统 SHALL NOT 以 `note.Region` 作为路由依据

### Requirement: Web创建工单分组来源

系统 SHALL 在 Web 创建工单时使用 assignment-first 分组选择逻辑。

#### Scenario: 已分组客户通过 Web 创建工单

- **GIVEN** 客户通过 Web 创建工单
- **AND** 客户存在 `CustomerGroupAssignment`
- **WHEN** 系统创建工单
- **THEN** 系统 SHALL 使用该服务分组的基础区域 Group 作为 `group_id`

#### Scenario: 未分组客户通过 Web 创建工单

- **GIVEN** 客户通过 Web 创建工单
- **AND** 客户不存在 `CustomerGroupAssignment`
- **WHEN** 系统创建工单
- **THEN** 系统 SHALL 使用暂存 Group 作为 `group_id`
