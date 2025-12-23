# 变更：修复Ticket系统核心Bug

## 原因
2025年12月19日用户测试反馈中发现6个核心Bug，影响工单系统的正常使用体验。这些问题需要优先修复以确保系统基本功能可用。

## 变更内容
- 修复工单列表状态不保持问题（筛选后返回丢失状态）
- 修复客户创建工单显示角色为Staff的问题
- **修复客户创建工单时附件未上传的问题** - 代码有TODO但未实现，files收集了但从未发送到API
- **修复附件下载链接路径错误** - 当前使用`/api/files/${att.id}`但Zammad附件需要专用API
- 修复工单状态在右上角不显示的问题
- 修复Profile语言设置无效的问题
- 修复Admin System Config页面点击无效的问题

## 代码审查发现

### 已确认的Bug（代码层面）
1. **工单附件上传未实现** (`src/app/customer/my-tickets/create/page.tsx:89-90`)
   - 第89行有`// TODO: Handle file attachments`注释
   - files状态收集了文件但handleSubmit中从未发送
   - Zammad API支持附件但前端未调用

2. **附件下载路径错误** (`src/components/ticket/article-content.tsx:173`)
   - 当前: `href={\`/api/files/${att.id}\`}` - 指向本地文件存储API
   - 应该: 使用Zammad附件下载API `/api/tickets/{ticketId}/articles/{articleId}/attachments/{attachmentId}`

### 需要进一步验证的问题
- 工单列表状态保持 - 可能是正常行为或需要URL参数持久化
- Profile语言设置 - 需要测试具体失效场景
- System Config页面 - 需要检查路由配置

## 影响

### 受影响的规范
- `ticket-system` - 工单列表和状态显示
- `user-settings` - 用户Profile设置

### 受影响的代码
- **前端组件**：
  - `src/app/staff/tickets/page.tsx` - 工单列表状态保持
  - `src/app/customer/my-tickets/page.tsx` - 工单列表
  - `src/components/ticket/ticket-list.tsx` - 工单列表组件
  - `src/components/ticket/ticket-detail.tsx` - 工单详情状态显示
  - `src/app/*/settings/page.tsx` - 用户设置页面
  - `src/app/admin/system-config/page.tsx` - 系统配置页面

- **后端API**：
  - `src/app/api/tickets/route.ts` - 工单创建角色处理
  - `src/app/api/tickets/[id]/route.ts` - 工单详情
  - `src/app/api/settings/route.ts` - 用户设置保存
  - `src/app/api/admin/config/route.ts` - 系统配置

## 测试反馈来源
- 反馈日期：2025/12/19
- 反馈人：Cody, Edward, Luca, Dover, SHAMY
- 原始文件：AI智能服务反馈—Ticket系统测试-工作表1.csv
