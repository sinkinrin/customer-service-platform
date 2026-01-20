# 任务清单：修复2026年1月用户反馈问题

## 阶段 1：权限与安全修复（P0）

### 1.1 Staff跨区数据隔离
- [x] 审计所有工单相关API的权限过滤
  - [x] `/api/tickets` (列表) - 已使用 filterTicketsByPermission
  - [x] `/api/tickets/[id]` (详情) - 已检查
  - [x] `/api/admin/stats/dashboard` (统计) - 仅admin可访问
  - [x] `/api/tickets/export` (导出) - 已检查
- [x] 创建Staff专用统计API或在现有API中添加角色过滤 - permission.ts已实现
- [x] 更新Staff Dashboard只请求本区域数据 - 已通过filterTicketsByPermission实现
- [x] 测试验证Staff无法看到跨区域数据

### 1.2 Customer激活状态过滤
- [x] 修改 `src/app/staff/customers/page.tsx` 添加 `active !== false` 过滤 - 已存在
- [x] 考虑在API层面添加 `active=true` 查询参数
- [x] 测试验证inactive客户不在列表中显示

### 1.3 Webhook定向推送
- [x] 分析 `src/lib/sse/emitter.ts` 当前广播逻辑
- [x] 实现根据工单owner_id和group_id过滤接收用户，还有admin
- [x] 测试验证不相关Staff不会收到更新

### 1.4 Admin账号排除自动分配
- [x] 修改 `src/app/api/tickets/auto-assign/route.ts`
- [x] 添加Admin角色排除逻辑: `agent.role_ids?.includes(1)`
- [x] 测试验证Admin账号不会被分配工单

---

## 阶段 2：功能修复（P1）

### 2.1 Email HTML模板修复
- [x] 检查 `scripts/setup-email-triggers.ts` 邮件模板格式
- [x] 设计正确的HTML邮件模板结构（使用table布局，内联CSS，适配各邮件客户端）
- [ ] 测试邮件在各客户端的渲染效果（需手动验证）

### 2.2 附件格式扩展
- [x] 修改 `src/components/ticket/ticket-actions.tsx` 第378行
- [x] 修改 `src/app/customer/my-tickets/[id]/page.tsx` 第352行、503行
- [x] 修改 `src/components/conversation/message-input.tsx` 第214行
- [x] 添加 `.zip,.rar,.7z,.mp4,.wmv,.avi,.mov` 格式支持
- [ ] 测试各格式文件上传和下载

### 2.3 个人设置功能实现
- [x] 创建 `PUT /api/user/profile` API（更新姓名、电话、语言到Zammad）
- [x] 创建 `PUT /api/user/preferences` API（存储通知偏好到Zammad preferences.csp_notifications）
- [x] 创建 `PUT /api/user/password` API（验证当前密码后更新）
- [x] 修改 `src/app/customer/settings/page.tsx` 调用实际API（从模拟改为真实请求）
- [ ] 测试设置保存和加载（需手动验证）

### 2.4 工单创建性能优化
- [x] 分析当前创建流程瓶颈
- [x] 评估分离附件上传的可行性
- [x] 添加创建进度显示
- [x] 验证Zammad用户缓存效果
- [x] 实现Zammad原生附件API（立即上传，使用attachment_ids引用）
- [x] 创建共享useFileUpload hook消除重复代码
- [x] 配置化上传超时参数

---

## 阶段 3：用户体验优化（P2）

### 3.1 附件UI改进
- [x] 修改 `src/components/ticket/article-content.tsx` 附件样式
- [x] 将 `text-gray-500` 改为更高对比度颜色 (`text-foreground`, `text-muted-foreground`)
- [x] 添加完整文件名tooltip
- [x] 添加翻译key `uploadingFiles`, `uploadSuccess`, `uploadFailed` 到所有语言文件

### 3.2 文本显示优化
- [x] 在工单标题使用 `break-words` 类
- [x] 为截断文本添加Tooltip组件
- [x] 检查其他可能截断的文本区域

### 3.3 工单评价展示增强
- [x] 在工单详情顶部添加评价状态显示
- [x] 在工单列表添加评价图标列
- [x] 在Dashboard添加评价统计卡片（已存在）

### 3.4 工单详情自动滚动
- [x] 在 `src/app/customer/my-tickets/[id]/page.tsx` 添加滚动逻辑
- [x] 在 `src/app/admin/tickets/[id]/page.tsx` 添加滚动逻辑
- [x] 在 `src/app/staff/tickets/[id]/page.tsx` 添加滚动逻辑

### 3.5 Pending状态说明
- [x] 在状态选择器添加tooltip说明
- [ ] 更新帮助文档说明Pending用途

### 3.6 工单模板优化
- [x] 将复现步骤、预期结果、实际结果改为选填
- [x] 减淡输入框中的提示文字

### 3.7 API 文档 (Scalar)
- [x] 集成 Scalar API 文档界面 (`/reference`)
- [x] 配置 `/api/openapi.json`
- [x] 文档化核心 API:
  - [x] Auth (`/api/auth/*`)
  - [x] Tickets (`/api/tickets/*`)
  - [x] Files (`/api/files/*`)
  - [x] FAQ (`/api/faq`)
  - [x] Admin Users (`/api/admin/users`)
  - [x] Conversations (`/api/conversations`)
<!-- - [ ] 添加模板变量支持 `{{customer_name}}`, `{{ticket_number}}`
- [ ] 实现变量替换逻辑
- [ ] 考虑快捷键触发 -->

---

## 阶段 4：扩展功能（P3）

### 4.1 区域内客户-Staff对应（暂不考虑）
- [ ] 设计 `CustomerStaffAssignment` 数据模型
- [ ] 创建数据库迁移
- [ ] 实现Admin绑定管理界面
- [ ] 修改自动分配逻辑优先使用绑定关系

---

## 进度跟踪

| 阶段 | 任务数 | 已完成 | 进度 |
|------|--------|--------|------|
| P0 权限安全 | 15 | 15 | 100% |
| P1 功能修复 | 17 | 17 | 100% |
| P2 体验优化 | 18 | 14 | 78% |
| P3 扩展功能 | 4 | 0 | 0% |
| **总计** | **54** | **46** | **85%** |

## 相关文档

- 反馈分析：[feedback-analysis-2026-01-14.md](../../../docs/feedback-analysis-2026-01-14.md)
- 提案文档：[proposal.md](./proposal.md)
