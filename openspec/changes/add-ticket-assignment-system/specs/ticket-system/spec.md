## ADDED Requirements

### Requirement: 员工假期管理
系统 SHALL 允许员工预设假期时间，Zammad 自动管理假期状态。

#### Scenario: 设置假期时间
- **WHEN** 员工设置假期开始和结束日期
- **THEN** 系统 SHALL 调用 Zammad Out-of-Office API 保存假期信息
- **AND** 到达开始日期时 Zammad 自动将状态设为"休假"
- **AND** 到达结束日期时 Zammad 自动恢复状态

#### Scenario: 设置假期代理人
- **WHEN** 员工设置假期时选择代理人
- **THEN** 系统 SHALL 记录 `out_of_office_replacement_id`
- **AND** 休假期间分配给该员工的新工单 SHALL 自动转给代理人

#### Scenario: 取消假期
- **WHEN** 员工取消已设置的假期
- **THEN** 系统 SHALL 调用 Zammad API 清除假期设置
- **AND** 员工恢复可分配状态

#### Scenario: 查看员工假期状态
- **WHEN** 管理员查看员工列表
- **THEN** 系统 SHALL 显示当前休假和即将休假的员工标记

---

### Requirement: 工单分配
系统 SHALL 支持将工单分配给可用员工（排除休假员工）。

#### Scenario: 手动分配工单
- **WHEN** 管理员选择一个未分配工单并指定员工
- **THEN** 系统 SHALL 调用 Zammad API 将工单分配给该员工
- **AND** 记录分配操作和时间

#### Scenario: 排除休假员工
- **WHEN** 管理员查看可分配员工列表
- **THEN** 系统 SHALL 在列表中标记休假员工
- **AND** 休假员工默认不显示或排在末尾

#### Scenario: 重新分配工单
- **WHEN** 管理员将已分配工单重新分配给其他员工
- **THEN** 系统 SHALL 更新工单的负责人
- **AND** 记录重新分配历史

#### Scenario: 取消分配
- **WHEN** 管理员取消工单的分配
- **THEN** 系统 SHALL 将工单状态设为"未分配"
- **AND** 工单返回待认领队列

---

### Requirement: 负载均衡分配建议
系统 SHALL 提供员工工作负载信息辅助分配决策。

#### Scenario: 显示员工工作负载
- **WHEN** 管理员打开分配弹窗
- **THEN** 系统 SHALL 显示每个员工当前未关闭工单数
- **AND** 推荐工单数最少的员工

#### Scenario: 工作负载排序
- **WHEN** 管理员查看可分配员工列表
- **THEN** 系统 SHALL 按工单数从少到多排序
- **AND** 休假员工排在末尾或隐藏

