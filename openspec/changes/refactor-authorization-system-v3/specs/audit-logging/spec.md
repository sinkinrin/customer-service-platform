# 审计日志规范

## ADDED Requirements

### Requirement: 审计日志记录
The system SHALL记录所有权限决策和敏感操作到审计日志。

#### Scenario: 权限决策记录
- **WHEN** PolicyEngine 做出权限决策
- **THEN** 记录 principalId、resourceType、action、decision、ruleId

#### Scenario: 拒绝决策详细记录
- **WHEN** 权限决策为拒绝
- **THEN** 记录详细拒绝原因

### Requirement: 跨区域分配审计
The system SHALL对跨区域工单分配记录详细审计信息。

#### Scenario: 跨区域分配记录
- **WHEN** 管理员将工单从区域 A 分配给区域 B 的员工
- **THEN** 记录原区域、目标区域、目标用户信息
- **AND** 记录是否自动变更了 group_id

### Requirement: 敏感操作审计
The system SHALL对用户管理、工单删除等敏感操作强制记录。

#### Scenario: 用户创建记录
- **WHEN** 创建新用户
- **THEN** 记录操作者、新用户信息

#### Scenario: 工单删除记录
- **WHEN** 删除工单
- **THEN** 记录操作者、工单 ID、工单标题

### Requirement: 审计日志查询
The system SHALL支持按用户、资源、时间范围查询审计日志。

#### Scenario: 按用户查询
- **WHEN** 查询指定用户的审计日志
- **THEN** 返回该用户所有相关记录

#### Scenario: 按资源查询
- **WHEN** 查询指定工单的审计日志
- **THEN** 返回该工单所有相关记录

## 数据模型

### AuditLog 表结构

```prisma
model AuditLog {
  id            String   @id @default(uuid())
  timestamp     DateTime @default(now())
  principalId   String
  principalRole String
  principalEmail String
  resourceType  String
  resourceId    String
  action        String
  decision      String   // 'allowed' | 'denied'
  ruleId        String
  reason        String
  metadata      String?  // JSON

  @@index([principalEmail])
  @@index([resourceType, resourceId])
  @@index([action])
  @@index([timestamp])
  @@map("audit_logs")
}
```

## 日志级别

| 环境 | 输出目标 | 记录范围 |
|------|---------|---------|
| 开发 | console | 所有决策 |
| 生产 | 数据库 | 拒绝决策 + 敏感操作 |

## 敏感操作列表

| 操作类型 | 资源类型 | 强制记录 |
|---------|---------|---------|
| delete | ticket | ✅ |
| assign | ticket | ✅ |
| export | ticket | ✅ |
| create | user | ✅ |
| delete | user | ✅ |
