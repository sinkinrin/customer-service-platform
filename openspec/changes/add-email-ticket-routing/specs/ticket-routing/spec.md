## ADDED Requirements

### Requirement: 邮件工单自动路由
系统 SHALL 在收到邮件创建的工单时自动将其路由到客户所属区域的Group。

#### Scenario: 邮件工单成功路由
- **GIVEN** 客户在Zammad中设置了Region（note字段包含 `Region: <region-value>`）
- **WHEN** 客户通过邮件创建工单，工单进入暂存Group（ID: 9）
- **THEN** 系统自动将工单移动到客户Region对应的Group
- **AND** 系统触发auto-assign将工单分配给该区域可用Staff

#### Scenario: 邮件工单无法路由
- **GIVEN** 客户在Zammad中未设置Region（note字段为空或不包含Region信息）
- **WHEN** 客户通过邮件创建工单，工单进入暂存Group（ID: 9）
- **THEN** 系统保持工单在暂存Group
- **AND** 系统向所有Admin发送通知，提示需要手动路由

#### Scenario: 无效Region值视为无法路由
- **GIVEN** 客户note字段包含Region信息但值不在允许列表中（例如 `Region: unknown-region`）
- **WHEN** 客户通过邮件创建工单，工单进入暂存Group（ID: 9）
- **THEN** 系统将该工单视为“无法路由”，保持其在暂存Group
- **AND** 系统向所有Admin发送通知，提示需要手动路由并标明无效Region值

#### Scenario: Web创建工单不触发路由
- **GIVEN** 用户通过Web界面创建工单
- **WHEN** 工单的article.type不是'email'
- **THEN** 系统跳过自动路由逻辑，不做任何处理

#### Scenario: 重复Webhook不重复路由
- **GIVEN** 工单已被路由到目标区域Group
- **WHEN** 系统收到同一工单的重复Webhook
- **THEN** 系统检测到group_id已变更，跳过路由

#### Scenario: Zammad API失败不阻塞Webhook
- **GIVEN** 系统需要调用Zammad API读取客户信息或更新工单
- **WHEN** 任一Zammad API调用失败
- **THEN** 系统记录错误日志
- **AND** 系统不应使Webhook处理失败（不返回非2xx作为失败信号）

### Requirement: 暂存Group常量配置
系统 SHALL 在 `src/lib/constants/regions.ts` 中定义暂存Group ID常量。

#### Scenario: 暂存Group ID配置
- **GIVEN** 系统需要识别暂存Group
- **WHEN** 代码引用 `STAGING_GROUP_ID`
- **THEN** 返回值为9（对应Zammad中的"暂存group"）

### Requirement: 无法路由工单Admin通知
系统 SHALL 在邮件工单无法自动路由时通知所有Admin用户。

#### Scenario: Admin收到未路由工单通知
- **GIVEN** 邮件工单因客户无Region信息无法路由
- **WHEN** 系统完成路由检查
- **THEN** 所有活跃Admin用户收到系统通知
- **AND** 通知包含工单编号和客户邮箱

### Requirement: 自动分配失败通知Admin
系统 SHALL 在邮件工单路由成功但自动分配失败时通知所有Admin用户，并且不回滚已完成的路由。

#### Scenario: 路由成功但自动分配失败
- **GIVEN** 邮件工单已被路由到目标区域Group
- **WHEN** 系统触发auto-assign但分配失败
- **THEN** 工单保持在目标区域Group（不回滚至暂存Group）
- **AND** 所有活跃Admin用户收到系统通知，包含工单编号与失败原因
