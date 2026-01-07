# 任务清单

## 1. P0 安全漏洞即时修复

### 1.1 AI Chat 认证
- [ ] 1.1.1 在 `src/app/api/ai/chat/route.ts` 添加 `requireAuth()` 调用
- [ ] 1.1.2 验证未登录用户返回 401

### 1.2 File 权限检查
- [ ] 1.2.1 修改 `src/app/api/files/[id]/route.ts` GET 方法
  - 验证文件所有权 (`userId === user.id`)
  - 或验证关联 ticket 的访问权限
- [ ] 1.2.2 修改 `src/app/api/files/[id]/download/route.ts`
  - 同上权限检查
- [ ] 1.2.3 验证非所有者无法下载他人文件

### 1.3 Rating ticket 验证
- [ ] 1.3.1 修改 `src/app/api/tickets/[id]/rating/route.ts` GET 方法
  - 使用 `checkTicketPermission` 验证访问权限
- [ ] 1.3.2 修改 POST 方法
  - 验证 ticket 属于当前 customer
- [ ] 1.3.3 验证客户无法为他人工单评分

### 1.4 Updates 权限过滤
- [ ] 1.4.1 修改 `src/app/api/tickets/updates/route.ts`
  - 获取用户可访问的 ticket ID 列表
  - 过滤 updates 只返回可访问工单的更新
- [ ] 1.4.2 验证 staff 只看到分配给自己的工单更新
- [ ] 1.4.3 验证 customer 只看到自己工单更新

### 1.5 Webhook 签名强制验证
- [ ] 1.5.1 修改 `src/app/api/webhooks/zammad/route.ts`
  - 生产环境强制验证签名
  - 开发环境可选（便于测试）
- [ ] 1.5.2 更新 `.env.example` 添加 `ZAMMAD_WEBHOOK_SECRET` 说明

### 1.6 permission.ts 修复
- [ ] 1.6.1 移除 `checkTicketPermission` 中 staff assign 权限（第123-126行）
- [ ] 1.6.2 修改 `canAssignTicket` 只返回 admin true
  ```typescript
  export function canAssignTicket(user: AuthUser): boolean {
    return user.role === 'admin'
  }
  ```
- [ ] 1.6.3 添加注释说明仅 Admin 可分配
- [ ] 1.6.4 调整 Staff 查看权限：仅可访问分配给自己的工单（移除按 group_id/region 的可见性）

### 1.7 Attachment 权限检查
- [ ] 1.7.1 修改 `src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`
  - 获取工单信息验证 Staff 是否为 owner（ticket.owner_id == session.user.zammad_id）
  - Customer 仍通过 X-On-Behalf-Of / ticket.customer_id 验证
- [ ] 1.7.2 验证 Staff 无法下载未分配/非自己负责工单附件

### 1.8 Export 统一权限过滤
- [ ] 1.8.1 修改 `src/app/api/tickets/export/route.ts`
  - 将 `filterTicketsByRegion` 替换为 `filterTicketsByPermission`
- [ ] 1.8.2 验证 Staff 只能导出分配给自己的工单

### 1.9 Templates 区域隔离
- [ ] 1.9.1 修改 `src/app/api/templates/route.ts` GET 方法
  - Staff 只返回其区域的模板或全局模板（region 为 null 或匹配用户区域）
- [ ] 1.9.2 修改 `src/app/api/templates/[id]/route.ts` GET/PUT 方法
  - 验证 Staff 只能访问/修改其区域的模板
- [ ] 1.9.3 验证 Staff 无法修改他区模板

### 1.10 Reopen 权限限制
- [ ] 1.10.1 修改 `src/app/api/tickets/[id]/reopen/route.ts`
  - 添加 Staff owner 校验（仅 owner 可重开；未分配/非 owner 一律拒绝）
  - 基于 ticket.owner_id 与 session.user.zammad_id 进行验证
- [ ] 1.10.2 验证 Staff 无法重开未分配/非 owner 工单

## 2. V3 核心架构实现

### 2.1 依赖安装
- [ ] 2.1.1 安装 js-yaml
  ```bash
  npm install js-yaml
  npm install -D @types/js-yaml
  ```

### 2.2 类型定义
- [ ] 2.2.1 创建 `src/lib/authorization/types.ts`
  - Principal 接口
  - Resource 接口
  - ResourceType 类型
  - ResourceState 类型
  - Action 类型
  - PolicyRule 接口
  - Condition 接口
  - ConditionType 类型
  - Decision 接口
  - ScopeDefinition 接口

### 2.3 Scope Registry
- [ ] 2.3.1 创建 `src/lib/authorization/scope-registry.ts`
  - SCOPE_DEFINITIONS 常量
  - ScopeRegistry 类
    - get(id) 方法
    - fromExternalId(externalId) 方法
    - contains(scopeA, scopeB) 方法
    - getAllRegionIds() 方法
    - getExternalId(scopeId) 方法
- [ ] 2.3.2 导出 scopeRegistry 单例

### 2.4 Principal Resolver
- [ ] 2.4.1 创建 `src/lib/authorization/principal-resolver.ts`
  - fromSession() 方法
  - fromWebhook() 方法
- [ ] 2.4.2 处理 admin 全局 scope
- [ ] 2.4.3 处理 staff/customer 区域 scope

### 2.5 Resource Resolver
- [ ] 2.5.1 创建 `src/lib/authorization/resource-resolver.ts`
  - fromTicket() 方法
  - fromFile() 方法
  - fromRating() 方法
  - fromUpdate() 方法
  - fromTemplate() 方法
  - fromConversation() 方法
  - resolveParentTicket() 方法
- [ ] 2.5.2 正确处理 unassigned 状态（owner_id 为 null/0/1）

### 2.6 Policy Engine
- [ ] 2.6.1 创建 `src/lib/authorization/policy-engine.ts`
  - evaluate() 方法
  - filter() 方法
  - matchesRule() 私有方法
  - evaluateCondition() 私有方法
  - isOwner() 私有方法
  - canViewParent() 私有方法
  - 父资源缓存机制
- [ ] 2.6.2 实现所有条件类型评估
  - authenticated
  - role_is, role_in
  - is_owner, is_assignee, is_self
  - scope_contains, scope_is_global, has_scopes
  - state_is, state_not
  - can_view_parent, parent_type_is
  - reference_type_is

### 2.7 Policy Loader
- [ ] 2.7.1 创建 `src/lib/authorization/policy-loader.ts`
  - loadAll() 方法
  - getDefaultPolicies() 方法
- [ ] 2.7.2 支持 YAML 和 YML 扩展名
- [ ] 2.7.3 添加加载失败回退策略

### 2.8 Authorization Wrapper
- [ ] 2.8.1 创建 `src/lib/authorization/with-authorization.ts`
  - withAuthorization() 高阶函数
  - AuthorizationConfig 接口
- [ ] 2.8.2 处理单资源和数组资源
- [ ] 2.8.3 Customer 返回 404（不泄露资源存在）

### 2.9 Audit Logger
- [ ] 2.9.1 创建 `src/lib/authorization/audit-logger.ts`
  - logDecision() 方法
  - logCrossRegionAssignment() 方法
  - query() 方法
- [ ] 2.9.2 支持 console 和 database 两种输出

### 2.10 模块导出
- [ ] 2.10.1 创建 `src/lib/authorization/index.ts`
  - 导出所有公共 API

## 3. 策略定义文件

### 3.1 创建策略目录
- [ ] 3.1.1 创建 `config/policies/` 目录

### 3.2 Ticket 策略
- [ ] 3.2.1 创建 `config/policies/ticket.yaml`
  - admin-ticket-access
  - deny-staff-unassigned
  - deny-staff-not-assignee
  - deny-staff-delete
  - deny-staff-assign
  - deny-customer-others
  - deny-no-scopes
  - allow-staff-assigned
  - allow-customer-own

### 3.3 File 策略
- [ ] 3.3.1 创建 `config/policies/file.yaml`
  - admin-file-access
  - owner-file-access
  - ticket-file-access
  - public-avatar-access

### 3.4 Rating 策略
- [ ] 3.4.1 创建 `config/policies/rating.yaml`
  - admin-rating-access
  - customer-own-rating
  - staff-rating-view

### 3.5 Update 策略
- [ ] 3.5.1 创建 `config/policies/update.yaml`
  - admin-update-access
  - user-update-access

### 3.6 其他策略
- [ ] 3.6.1 创建 `config/policies/template.yaml`
- [ ] 3.6.2 创建 `config/policies/conversation.yaml`
- [ ] 3.6.3 创建 `config/policies/user.yaml`
- [ ] 3.6.4 创建 `config/policies/ai-chat.yaml`
- [ ] 3.6.5 创建 `config/policies/session.yaml`
- [ ] 3.6.6 创建 `config/policies/vacation.yaml`
- [ ] 3.6.7 创建 `config/policies/faq.yaml`

## 4. 数据库变更

### 4.1 AuditLog 模型
- [ ] 4.1.1 更新 `prisma/schema.prisma` 添加 AuditLog 模型
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
    decision      String
    ruleId        String
    reason        String
    metadata      String?

    @@index([principalEmail])
    @@index([resourceType, resourceId])
    @@index([action])
    @@index([timestamp])
    @@map("audit_logs")
  }
  ```
- [ ] 4.1.2 执行数据库迁移
  ```bash
  npx prisma migrate dev --name add_audit_log
  ```
- [ ] 4.1.3 生成 Prisma Client

## 5. API 迁移

### 5.1 P0 API 迁移（优先）
- [ ] 5.1.1 迁移 `api/tickets/[id]/rating/route.ts`
- [ ] 5.1.2 迁移 `api/tickets/updates/route.ts`
- [ ] 5.1.3 迁移 `api/files/[id]/route.ts`
- [ ] 5.1.4 迁移 `api/files/[id]/download/route.ts`

### 5.2 Ticket API 迁移
- [ ] 5.2.1 迁移 `api/tickets/route.ts`
- [ ] 5.2.2 迁移 `api/tickets/[id]/route.ts`
- [ ] 5.2.3 迁移 `api/tickets/search/route.ts`
- [ ] 5.2.4 迁移 `api/tickets/export/route.ts`
- [ ] 5.2.5 迁移 `api/tickets/[id]/articles/route.ts`

### 5.3 其他 API 迁移
- [ ] 5.3.1 迁移 templates API
- [ ] 5.3.2 迁移 conversations API
- [ ] 5.3.3 迁移 staff API
- [ ] 5.3.4 迁移 admin API

## 6. 清理遗留代码

### 6.1 permission.ts 清理
- [ ] 6.1.1 标记 `checkTicketPermission` 为 deprecated
- [ ] 6.1.2 标记 `filterTicketsByPermission` 为 deprecated
- [ ] 6.1.3 更新使用处迁移到 PolicyEngine

### 6.2 region-auth.ts 清理
- [ ] 6.2.1 标记 `hasRegionAccess` 为 deprecated
- [ ] 6.2.2 标记 `filterTicketsByRegion` 为 deprecated
- [ ] 6.2.3 更新使用处迁移到 ScopeRegistry

### 6.3 内联权限检查清理
- [ ] 6.3.1 移除 API 文件中的内联权限逻辑
- [ ] 6.3.2 统一使用 withAuthorization 包装器

## 7. 测试

### 7.1 单元测试
- [ ] 7.1.1 创建 `__tests__/authorization/scope-registry.test.ts`
- [ ] 7.1.2 创建 `__tests__/authorization/principal-resolver.test.ts`
- [ ] 7.1.3 创建 `__tests__/authorization/resource-resolver.test.ts`
- [ ] 7.1.4 创建 `__tests__/authorization/policy-engine.test.ts`
  - Ticket 权限测试
  - File 权限测试（父资源桥接）
  - Rating 权限测试
  - Update 权限测试

### 7.2 集成测试
- [ ] 7.2.1 创建 `__tests__/api/authorization-integration.test.ts`
  - GET /api/tickets/updates 过滤测试
  - POST /api/tickets/[id]/rating 所有权测试
  - GET /api/files/[id]/download 权限测试
  - POST /api/ai/chat 认证测试

### 7.3 回归测试
- [ ] 7.3.1 验证现有功能不受影响
- [ ] 7.3.2 多区域账号测试
- [ ] 7.3.3 跨区域分配测试

## 8. 文档更新

### 8.1 CLAUDE.md 更新
- [ ] 8.1.1 更新权限系统说明
- [ ] 8.1.2 添加 authorization 模块说明
- [ ] 8.1.3 添加策略文件说明

### 8.2 API 文档
- [ ] 8.2.1 更新 API 权限说明
- [ ] 8.2.2 添加错误响应码说明

## 进度跟踪

| 阶段 | 状态 | 备注 |
|------|------|------|
| 1. P0 安全修复 | 待开始 | 最高优先级 |
| 2. V3 核心架构 | 待开始 | |
| 3. 策略定义 | 待开始 | |
| 4. 数据库变更 | 待开始 | |
| 5. API 迁移 | 待开始 | |
| 6. 清理遗留 | 待开始 | |
| 7. 测试 | 待开始 | |
| 8. 文档更新 | 待开始 | |
