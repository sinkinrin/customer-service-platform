# 设计文档：添加工单通知系统

## 上下文

客户创建工单后，分配的员工无法及时收到通知，导致响应延迟。同时缺乏工单超时提醒机制。

> [!NOTE]
> **完全使用 Zammad 内置功能**：邮件通知和定时提醒均通过 Zammad Triggers 和 Scheduler 配置实现，无需应用层开发。

### 利益相关者
- **客服人员（Staff）** - 需要及时收到分配给自己的工单通知
- **管理员（Admin）** - 需要了解工单处理情况
- **客户（Customer）** - 期望快速响应

## 目标 / 非目标

### 目标
- 工单分配后，分配的 Staff 收到邮件通知
- 超时未处理的工单自动发送提醒邮件
- 通过 Zammad 配置实现，无需开发

### 非目标
- ~~给整个区域所有 Staff 发邮件~~（只给分配的 Staff 发）
- ~~自建邮件服务~~（使用 Zammad 内置邮件）
- 实时推送通知（WebSocket/SSE）
- 短信通知

## 实现方案：Zammad 配置

### 1. 工单分配通知（Zammad Trigger）

**配置路径**：Zammad Admin → Manage → Triggers

| 配置项 | 值 |
|-------|-----|
| 名称 | 工单分配通知 |
| Activator | Ticket owner changed |
| 条件 | Owner is not (empty) |
| 动作 | Send email to ticket owner |

**邮件内容变量**：
- `#{ticket.title}` - 工单标题
- `#{ticket.number}` - 工单编号
- `#{ticket.customer.name}` - 客户姓名
- `#{ticket.url}` - 工单链接

### 2. 超时提醒（Zammad Scheduler）

**配置路径**：Zammad Admin → Manage → Scheduler

| 配置项 | 值 |
|-------|-----|
| 名称 | 24小时未处理提醒 |
| 执行时间 | 每小时 |
| 条件 | State = open AND updated_at older than 24 hours |
| 动作 | Send email to ticket owner |

### 3. 每日汇总（Zammad Scheduler）

| 配置项 | 值 |
|-------|-----|
| 名称 | 每日未关闭工单汇总 |
| 执行时间 | 每天 09:00 |
| 条件 | State = open |
| 动作 | Send email to admin |

## 优势

| 方面 | Zammad 方案 |
|------|------------|
| 开发工作量 | ✅ 零开发，纯配置 |
| 邮件服务 | ✅ 使用 Zammad 邮件通道 |
| 定时任务 | ✅ Zammad Scheduler |
| 可靠性 | ✅ 生产级实现 |

## 风险 / 权衡

### 风险：工单未分配时无人收到通知
- **缓解措施**：配置另一个 Trigger，工单创建且无 Owner 时通知 Admin

### 风险：邮件发送失败
- **缓解措施**：Zammad 有内置重试机制

## 开放问题

1. 超时提醒的时间阈值（24小时/48小时）是否需要调整？
2. 每日汇总发送给哪个 Admin 邮箱？
