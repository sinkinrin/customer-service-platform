# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

