# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] - 2025-11-18

### 🐛 修复

#### R1: Ticket SSE 权限泄露修复
- **文件**: `src/app/api/sse/tickets/route.ts:8,19-25,86-89`
- 添加角色验证,只允许 staff/admin 连接到 ticket SSE 端点
- 使用 `requireRole(['staff', 'admin'])` 替代 `mockGetUser()` 进行身份验证
- 添加 try-catch 错误处理,未授权用户返回 403 Forbidden
- 修复安全漏洞:任何已登录的 customer 都可以连接到 `/api/sse/tickets` 并监听所有票务变更
- 防止客户窃听票务 ID、标题、优先级和区域等敏感信息

#### R2: AI 消息发送者角色标记修复
- **文件**: `src/app/api/conversations/[id]/messages/route.ts:153-169`
- 支持 `metadata.role='ai'` 参数,允许客户端正确标记 AI 消息
- 安全验证: 只有当对话处于 AI 模式时才允许标记为 AI 角色 (`conversation.mode === 'ai'`)
- 防止客户在 human 模式下伪造 AI 消息误导员工
- AI 消息的 `sender_name` 正确显示为 "AI Assistant" 而非客户名称
- 修复问题:客户端发送的 AI 回复被错误标记为 customer 角色,导致员工无法区分用户消息和 AI 回复
- 转人工后,员工现在能看到清晰标注的对话历史(customer/ai 角色区分)

#### R3: AI 聊天历史同步修复
- **文件**: `src/app/customer/conversations/[id]/page.tsx:169-178`
- 修复 AI API 调用时的历史记录构建逻辑
- 使用 `[...aiMessages, newUserMessage]` 而非仅 `aiMessages`,包含刚输入的用户消息
- 解决 React 状态异步更新导致最新消息缺失的问题
- AI 现在能看到完整的对话历史,包括用户刚发送的问题
- 提升 AI 回复质量和上下文连贯性

### 技术细节

- 所有修复基于 code review 发现的安全和数据完整性问题
- 更改保持向后兼容,遵循现有代码模式
- 无数据库架构更改
- TypeScript 类型检查通过,未引入新的类型错误
- 包含清晰的 R1/R2/R3 注释便于需求追溯

---

## [0.1.4] - 2025-11-18

### 🐛 修复

#### R1: 票务实时SSE事件广播
- **文件**: `src/app/api/tickets/route.ts:292-308`, `src/app/api/tickets/[id]/route.ts:267-283,322-333`, `src/app/api/webhooks/zammad/route.ts:88-121`
- 添加 `broadcastEvent()` 调用到票务 CRUD 操作和 webhook 处理器
- 创建、更新、删除票务时发送 SSE 事件到管理员和员工
- 前端 `/admin/tickets` 和 `/staff/tickets` 页面无需手动刷新即可显示"新更新"徽章
- 修复问题：管理员和员工票务列表页面已经监听 SSE 事件，但后端从未发送事件

#### R2: API错误响应规范化
- **文件**: `src/app/api/faq/route.ts:31`, `src/app/api/tickets/search/route.ts:149,154`, `src/app/api/tickets/[id]/route.ts:155,195,311,316`, `src/app/api/tickets/[id]/articles/route.ts:45,76`
- 修正所有 `errorResponse()` 调用使用正确的4参数格式：`errorResponse(code, message, details, status)`
- 现在所有 API 错误返回描述性的 `error.code` 和 `error.message` 对
- UI toasts (Sonner) 显示可读的错误原因而非 HTTP 状态码（如 "400"）
- 修复前：`errorResponse('Limit must be between 1 and 1000', 400)` - 缺少错误代码
- 修复后：`errorResponse('INVALID_LIMIT', 'Limit must be between 1 and 1000', undefined, 400)`

#### R3: AI对话历史持久化
- **文件**: `src/app/customer/conversations/[id]/page.tsx:115-180,82-123`, `src/app/api/conversations/[id]/transfer/route.ts:20-24,88-120`
- `handleAIMessage()` 现在将用户消息和 AI 回复都持久化到 `local-conversation-storage`
- 页面加载时从存储加载已持久化的 AI 消息，对话历史在页面刷新后保留
- 转人工端点从存储读取持久化历史（而非仅依赖客户端payload），即使页面刷新后也能保证完整历史记录
- 修复问题：AI 对话仅存在于组件 state 中，页面刷新后丢失；转人工时可能丢失对话上下文

### 技术细节

- 所有修复实现 OpenSpec 提案: `update-ticket-sse-and-ai-history`
- 更改保持向后兼容，遵循现有代码模式
- 无数据库架构更改
- TypeScript 类型检查通过，未引入新的类型错误
- 包含清晰的 R1/R2/R3 注释便于需求追溯

### 参考

- OpenSpec 提案: `openspec/changes/update-ticket-sse-and-ai-history/proposal.md`
- 任务列表: `openspec/changes/update-ticket-sse-and-ai-history/tasks.md`

---

## [0.1.3] - 2025-11-14

### 🐛 修复

#### R1: Admin 区域过滤器使用 group_id
- **文件**: `src/app/admin/tickets/page.tsx:97-103`
- 修复区域过滤逻辑，使用规范的 `group_id` 而非本地化的 `labelEn` 进行比较
- 解决 Africa 和 Europe Zone 2 等共享 fallback group 的区域无法正确过滤票务的问题
- 通过 `getGroupIdByRegion()` 获取区域对应的 Zammad Group ID，直接比较 `ticket.group_id`
- 修复前：比较 "Users" (ticket.group) 与 "Africa" (ticketRegion.labelEn) 导致不匹配
- 修复后：比较 group_id (1 vs 1) 正确匹配

#### R2: 对话更新同时通知客户和员工
- **文件**: `src/app/api/conversations/[id]/route.ts:160-178`
- 修复 SSE 广播逻辑，conversation_updated 事件现在同时发送给客户和已分配的员工
- 员工实时看到对话状态变化（关闭、重新打开、重新分配等）
- 修复前：只广播给 `[updated.customer_id]`
- 修复后：广播给 `[updated.customer_id, updated.staff_id]`（如果有 staff_id）

#### R3: Staff 票务详情页面创建
- **文件**: `src/app/staff/tickets/[id]/page.tsx` (新建)
- 创建完整的 Staff 票务详情页面，复用 `TicketDetail` 和 `TicketActions` 组件
- 支持查看票务信息、历史对话、添加回复和内部备注
- 员工点击票务列表不再出现 404 错误
- 与 Admin 票务详情页面类似，但去除了删除功能（Staff 无权限）

#### 类型修复
- **文件**: `src/lib/stores/ticket-store.ts:12`
- 为 `ZammadTicket` 接口添加 `group_id?: number` 字段
- 修复 TypeScript 类型错误，支持使用 `group_id` 进行过滤

### 技术细节

- 所有修复实现 OpenSpec 提案: `update-support-routing-and-realtime`
- 更改保持向后兼容，遵循现有代码模式
- 无数据库架构更改
- TypeScript 类型检查通过，未引入新的类型错误
- 成功复用现有组件（TicketDetail, TicketActions），保持代码 DRY

### 参考

- OpenSpec 提案: `openspec/changes/update-support-routing-and-realtime/proposal.md`
- 任务列表: `openspec/changes/update-support-routing-and-realtime/tasks.md`

## [0.1.2] - 2025-11-14

### 🐛 修复

#### R1: Admin 票务区域过滤器修正
- **文件**: `src/app/admin/tickets/page.tsx:102`
- 修复区域过滤逻辑，使用规范的英文名称 (`labelEn`) 而非本地化标签 (`label`)
- 解决选择区域后所有票务被隐藏的问题
- Zammad 返回的 `ticket.group` 是英文名（如 "Asia-Pacific"），现在正确匹配 `ticketRegion.labelEn`
- 修复前：比较 "Asia-Pacific" 与 "亚太区 (Asia-Pacific)" 导致不匹配

#### R2: 对话附件消息类型保存
- **文件**:
  - `src/lib/local-conversation-storage.ts:204-234` - `addMessage()` 函数
  - `src/lib/local-conversation-storage.ts:36-45` - `LocalMessage` 接口
  - `src/app/api/conversations/[id]/messages/route.ts:163-170` - API 路由
  - `src/lib/stores/conversation-store.ts:10-33` - Message 接口
- 更新 `addMessage()` 函数接受可选的 `message_type` 参数
- 支持消息类型：`'text' | 'image' | 'file' | 'system' | 'transfer_history'`
- API 路由现在正确传递 `message_type` 到存储层
- 扩展 `Message` 接口以支持附件 metadata（`file_name`, `file_size`, `file_url`, `mime_type` 等）
- 修复问题：客户上传的图片/文件被硬编码为 `'text'` 类型，导致 MessageList 无法渲染附件

#### R3: Staff 标记已读权限放宽
- **文件**: `src/app/api/conversations/[id]/mark-read/route.ts:33-48`
- 放宽权限检查，允许任何 staff/admin 标记 human 模式对话为已读
- 第一个接手转人工对话的员工现在可以清除自己的未读计数
- 未读计数保持按 `staff_id` 隔离（每个员工只看到自己的未读数）
- 修复问题：转人工后 `staff_id` 未设置，导致员工无法标记对话已读，未读徽章永远 >0

### 技术细节

- 所有修复实现 OpenSpec 提案: `update-support-ux-consistency`
- 更改保持向后兼容，遵循现有代码模式
- 无数据库架构更改
- TypeScript 类型检查通过，未引入新错误
- 包含清晰的 R1/R2/R3 注释便于需求追溯

### 参考

- OpenSpec 提案: `openspec/changes/update-support-ux-consistency/proposal.md`
- 任务列表: `openspec/changes/update-support-ux-consistency/tasks.md`

---

## [0.1.1] - 2025-11-14

### 🐛 修复

#### R1: Switch-to-AI 端点安全加固
- **文件**: `src/app/api/conversations/[id]/switch-to-ai/route.ts`
- 添加了 `requireAuth()` 身份验证调用
- 实现参与者权限检查（只有对话拥有者、分配的员工或管理员可切换模式）
- 添加 401/403 错误处理，防止未授权访问
- 与 transfer 端点的安全模式保持一致
- 修复安全漏洞：任何未认证用户都能将对话从人工模式切换回 AI 模式

#### R2: Mark-Read 未读计数按员工隔离
- **文件**: `src/app/api/conversations/[id]/mark-read/route.ts`
- 员工调用 `getStaffUnreadCount(user.id)` 只看到分配给自己的对话未读数
- 管理员继续调用 `getStaffUnreadCount()` 无参数，看到全局未读计数
- 改进 SSE 广播逻辑，使每个员工只收到自己的未读计数更新
- 修复问题：员工标记对话已读后，所有员工都看到全局未读计数而非个人计数

#### R3: 客户对话页面防止重复创建
- **文件**: `src/app/customer/conversations/page.tsx`
- 添加显式的 `conversationsLoaded` 标志
- 确保在 `fetchConversations()` 完成后才执行创建/重定向逻辑
- 优先重用现有的活动对话，只在没有活动对话时才创建新对话
- 修复问题：客户访问 `/customer/conversations` 时会在获取对话列表前创建重复对话

### 技术细节

- 所有修复实现 OpenSpec 提案: `update-conversation-security-and-launch`
- 更改保持向后兼容，遵循现有代码模式
- 无数据库架构更改
- 包含清晰的 R1/R2/R3 注释便于需求追溯

### 参考

- OpenSpec 提案: `openspec/changes/update-conversation-security-and-launch/proposal.md`
- 任务列表: `openspec/changes/update-conversation-security-and-launch/tasks.md`
- 提交: [94fbd11](https://github.com/user/customer-service-platform/commit/94fbd11)

---

## [0.1.0] - 2025-11-14

### Fixed

#### R1: FAQ Category Filtering Parameter Compatibility
- **Files**: `src/app/api/faq/route.ts`, `src/app/api/admin/faq/route.ts`
- Fixed FAQ category filtering to support both `categoryId` (camelCase) and `category_id` (snake_case) query parameters
- Ensures backward compatibility with existing API consumers
- Resolves issue where customer/staff FAQ pages failed to filter by category

#### R2: Conversation Creation Initial Message Persistence
- **Files**: `src/app/api/conversations/route.ts`
- Fixed conversation creation to properly persist and broadcast `initial_message` from request payload
- Initial customer messages are now saved to local storage immediately
- SSE events are broadcast to update UI in real-time
- Prevents loss of the first customer question when starting a new chat

#### R3: Mark-Read Endpoint Participant Authorization
- **Files**: `src/app/api/conversations/[id]/mark-read/route.ts`
- Added participant verification to mark-read endpoint
- Only conversation participants (customer owner or assigned staff/admin) can mark conversations as read
- Non-participants receive 403 Forbidden error
- Prevents unauthorized users from resetting unread counters

#### R4: Staff Unread Count Per-User Isolation
- **Files**: `src/lib/local-conversation-storage.ts`, `src/app/api/conversations/unread-count/route.ts`
- Modified `getStaffUnreadCount()` to support per-user filtering
- Staff members now see only their assigned conversations' unread counts
- Admin users continue to see global unread counts
- Enables proper queue management and shift handoffs

#### R5: Customer Ticket Visibility Regardless of Group Reassignment
- **Files**: `src/lib/utils/region-auth.ts`
- Fixed `filterTicketsByRegion()` to preserve customer access to their tickets
- Customers now see all their tickets regardless of group_id changes
- Ticket ownership (customer_id) now takes precedence over group assignment for customer access
- Staff region filtering remains intact for security
- Resolves issue where customers lost access to tickets after agent reassignment

### Technical Details

- All fixes implement OpenSpec proposal: `update-faq-conversation-ticket-integrity`
- Changes maintain backward compatibility with existing API contracts
- No database schema changes required
- All modifications follow existing code patterns and conventions

### References

- OpenSpec Proposal: `openspec/changes/update-faq-conversation-ticket-integrity/proposal.md`
- Task List: `openspec/changes/update-faq-conversation-ticket-integrity/tasks.md`

---

## [Unreleased]

### Added
- Initial changelog file

