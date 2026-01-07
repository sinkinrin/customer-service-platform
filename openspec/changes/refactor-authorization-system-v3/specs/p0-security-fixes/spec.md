# P0 安全漏洞修复规范

## ADDED Requirements

### Requirement: AI Chat 认证
The system SHALL对 AI 聊天端点进行身份认证。

#### Scenario: 未登录用户被拒绝
- **WHEN** 未登录用户调用 POST /api/ai/chat
- **THEN** 返回 401 Unauthorized

#### Scenario: 登录用户可使用
- **WHEN** 登录用户调用 POST /api/ai/chat
- **THEN** 正常返回 AI 响应

### Requirement: 文件访问权限检查
The system SHALL对文件访问进行权限检查，验证所有权或工单关联。

#### Scenario: 所有者可下载文件
- **WHEN** 用户请求下载自己上传的文件
- **THEN** 允许下载

#### Scenario: 工单关联文件可访问
- **WHEN** 用户请求下载关联到可访问工单的文件
- **THEN** 允许下载

#### Scenario: 无权限文件拒绝访问
- **WHEN** 用户请求下载非自己且非关联工单的文件
- **THEN** 客户返回 404，员工/管理员返回 403

### Requirement: 工单评分权限检查
The system SHALL验证用户对工单的访问权限后才能查看或提交评分。

#### Scenario: 客户可评价自己工单
- **WHEN** 客户请求为自己的工单评分
- **THEN** 允许评分操作

#### Scenario: 客户无法评价他人工单
- **WHEN** 客户请求为他人工单评分
- **THEN** 返回 404

#### Scenario: 员工可查看自己负责工单评分
- **WHEN** 员工请求查看自己负责工单的评分
- **THEN** 允许查看

### Requirement: 工单更新权限过滤
The system SHALL根据用户权限过滤工单更新事件。

#### Scenario: 客户只收到自己工单更新
- **WHEN** 客户请求 GET /api/tickets/updates
- **THEN** 只返回自己工单的更新

#### Scenario: 员工只收到自己负责工单更新
- **WHEN** 员工请求 GET /api/tickets/updates
- **THEN** 只返回分配给自己的工单的更新

#### Scenario: 管理员收到所有更新
- **WHEN** 管理员请求 GET /api/tickets/updates
- **THEN** 返回所有工单更新

### Requirement: Webhook 签名验证
The system SHALL在生产环境强制验证 Zammad Webhook 签名。

#### Scenario: 生产环境无签名被拒绝
- **WHEN** 生产环境收到无签名的 Webhook 请求
- **THEN** 返回 401

#### Scenario: 生产环境无效签名被拒绝
- **WHEN** 生产环境收到无效签名的 Webhook 请求
- **THEN** 返回 401

#### Scenario: 开发环境可选验证
- **WHEN** 开发环境收到 Webhook 请求
- **AND** 未配置 ZAMMAD_WEBHOOK_SECRET
- **THEN** 允许处理请求

### Requirement: 工单分配权限统一
The system SHALL统一 permission.ts 与 API 的分配权限逻辑。

#### Scenario: canAssignTicket 只允许管理员
- **WHEN** 调用 canAssignTicket(staffUser)
- **THEN** 返回 false

#### Scenario: checkTicketPermission 拒绝员工分配
- **WHEN** 调用 checkTicketPermission({ user: staffUser, action: 'assign' })
- **THEN** 返回 { allowed: false }

### Requirement: Attachment 下载权限检查
The system SHALL验证 Staff 对工单的访问权限后才能下载附件。

#### Scenario: Staff 下载自己负责工单附件
- **WHEN** Staff 请求下载分配给自己的工单的附件
- **THEN** 允许下载

#### Scenario: Staff 下载非自己负责工单附件被拒绝
- **WHEN** Staff 请求下载非自己负责工单的附件
- **THEN** 返回 403

#### Scenario: 管理员可下载任意附件
- **WHEN** 管理员请求下载任意工单的附件
- **THEN** 允许下载

### Requirement: Export 使用统一权限过滤
The system SHALL在导出工单时使用统一的权限过滤函数。

#### Scenario: Staff 导出自己负责工单
- **WHEN** Staff 请求导出工单
- **THEN** 只导出分配给自己的工单

#### Scenario: 管理员导出全部工单
- **WHEN** 管理员请求导出工单
- **THEN** 可导出所有工单

### Requirement: Templates 区域隔离
The system SHALL根据用户区域过滤可访问的模板。

#### Scenario: Staff 访问区域模板
- **WHEN** Staff 请求获取模板
- **THEN** 只返回其区域的模板或全局模板

#### Scenario: Staff 修改他区模板被拒绝
- **WHEN** Staff 请求修改非其区域的模板
- **THEN** 返回 403

#### Scenario: 管理员可管理所有模板
- **WHEN** 管理员请求管理任意模板
- **THEN** 允许操作

### Requirement: Reopen 权限限制
The system SHALL验证 Staff 对工单的访问权限后才能重开工单。

#### Scenario: Staff 重开已分配给自己的工单
- **WHEN** Staff 请求重开分配给自己的已关闭工单
- **THEN** 允许重开

#### Scenario: Staff 重开未分配工单被拒绝
- **WHEN** Staff 请求重开未分配工单
- **THEN** 返回 403

#### Scenario: Staff 重开非自己负责工单被拒绝
- **WHEN** Staff 请求重开非自己负责的工单
- **THEN** 返回 403

## 漏洞详情

### 1. AI Chat 无认证

**位置**：`src/app/api/ai/chat/route.ts`

**问题**：POST 端点完全没有认证检查。

**风险**：
- 资源滥用（API 调用费用）
- 可能泄露训练数据
- DoS 攻击向量

### 2. File 无权限检查

**位置**：
- `src/app/api/files/[id]/route.ts`
- `src/app/api/files/[id]/download/route.ts`

**问题**：只检查登录状态，不检查文件所有权。

### 3. Rating 无 Ticket 验证

**位置**：`src/app/api/tickets/[id]/rating/route.ts`

**问题**：GET/POST 都不验证工单访问权限。

### 4. Updates 泄露全部

**位置**：`src/app/api/tickets/updates/route.ts`

**问题**：返回所有工单更新，无权限过滤。

### 5. Webhook 签名可选

**位置**：`src/app/api/webhooks/zammad/route.ts`

**问题**：`if (webhookSecret && signature)` 使验证可选。

### 6. permission.ts 不一致

**位置**：`src/lib/utils/permission.ts`

**问题**：第 123-126 行允许 staff assign，与 API 行为矛盾。

### 7. Attachment 下载无 Staff 工单访问验证

**位置**：`src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`

**问题**：第 49-51 行，Staff 直接调用 `zammadClient.downloadAttachment`，未验证该 Staff 是否有权访问父工单（应至少校验 `ticket.owner_id === session.user.zammad_id`）。

**风险**：数据泄露，Staff 可访问非自己负责工单的敏感文件。

### 8. Export 使用旧过滤函数

**位置**：`src/app/api/tickets/export/route.ts`

**问题**：第 86 行使用 `filterTicketsByRegion` 而非 `filterTicketsByPermission`，可能导出未分配工单。

**风险**：Staff 可能导出不应访问的工单数据。

### 9. Templates 无区域隔离

**位置**：`src/app/api/templates/[id]/route.ts`

**问题**：GET/PUT 只检查 `role !== 'customer'`，Staff 可访问/修改任何区域的模板。

**风险**：Staff 可能误修改其他区域的模板。

### 10. Reopen 权限过宽

**位置**：`src/app/api/tickets/[id]/reopen/route.ts`

**问题**：第 50-59 行只对 Customer 验证工单所有权，任何 Staff 可重开任意工单。

**风险**：Staff 可能越权操作非自己负责的工单。
