## ADDED Requirements

### Requirement: 工单分配邮件通知
Zammad SHALL 在工单分配后向被分配的 Staff 发送邮件通知。

#### Scenario: 工单分配通知
- **WHEN** 工单被分配给某个 Staff
- **THEN** Zammad Trigger SHALL 向该 Staff 发送邮件通知
- **AND** 邮件 SHALL 包含工单标题、编号和客户信息
- **AND** 邮件 SHALL 包含工单链接

#### Scenario: 工单未分配
- **WHEN** 工单创建但未分配
- **THEN** 系统不发送邮件通知
- **AND** 工单进入待认领队列

---

### Requirement: 未处理工单定时提醒
Zammad Scheduler SHALL 定时检查超时工单并发送提醒。

#### Scenario: 24小时未处理提醒
- **WHEN** 工单超过24小时未更新且状态为 open
- **THEN** Zammad Scheduler SHALL 向工单负责人发送提醒邮件

#### Scenario: 每日未关闭工单汇总
- **WHEN** 每天定时任务执行
- **THEN** Zammad Scheduler SHALL 向管理员发送未关闭工单汇总

---

### Requirement: 通知配置
管理员 SHALL 能够在 Zammad 管理后台配置通知规则。

#### Scenario: 配置 Trigger
- **WHEN** 管理员在 Zammad Admin → Manage → Triggers 创建触发器
- **THEN** 系统 SHALL 按配置的条件和动作发送邮件

#### Scenario: 配置 Scheduler
- **WHEN** 管理员在 Zammad Admin → Manage → Scheduler 创建调度器
- **THEN** 系统 SHALL 按配置的时间和条件执行定时任务
