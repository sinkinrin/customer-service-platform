# 变更：Staff Portal 优化与修复

## 原因

通过全面的代码分析和用户界面测试（使用Playwright），发现Staff Portal存在多个关键Bug和功能缺失，严重影响客服人员的工作效率。主要问题包括：

1. **Conversations页面完全不可用** - TypeError崩溃
2. **Tickets详情页路由错误** - 导致404页面
3. **Knowledge Base页面不存在** - 404错误
4. **实时通知系统未完全集成** - SSE连接超时
5. **缺少关键工作流功能** - 工单分配、响应模板等

这些问题直接阻碍客服人员处理客户请求，必须立即修复。

## 变更内容

### 阶段1：紧急Bug修复（P0）
- 修复 Conversations 页面的 `conversations.filter is not a function` 错误
- 修复 Tickets 详情页路由（从 `/staff/tickets/97` 到 `/staff/tickets/60097`）
- 创建或修复 Staff Knowledge Base 页面路由
- 解决 SSE 连接的 Heartbeat timeout 问题

### 阶段2：核心功能完善（P1）
- 实现工单分配和所有权管理
- 创建响应模板系统（快速回复、保存的回复）
- 完善对话升级工作流（AI→人工转接）
- 实现文件上传功能（工单附件、对话附件）

### 阶段3：用户体验增强（P2）
- 添加 Staff Dashboard KPI 指标
- 实现队列管理系统
- 添加客户详情侧边栏
- 实现批量操作功能（批量分配、批量关闭）
- 添加 Staff 个人设置页面

### 阶段4：高级功能（P3）
- 实现技能路由系统
- 添加性能分析仪表板
- 实现工单模板系统
- 添加排班管理功能

## 影响

### 受影响的规范
- `faq-system` - Knowledge Base 集成
- `conversation-system` - 对话管理（需创建）
- `ticket-system` - 工单管理（需创建）

### 受影响的代码
- **前端组件**：
  - `src/app/(staff)/conversations/page.tsx` - 需要修复数据获取逻辑
  - `src/app/(staff)/tickets/[id]/page.tsx` - 需要修复路由参数
  - `src/app/(staff)/knowledge/page.tsx` - 需要创建
  - `src/components/staff/` - 新增组件（响应模板、工单分配等）

- **API路由**：
  - `src/app/api/sse/tickets/route.ts` - 修复 SSE 实现
  - `src/app/api/staff/` - 新增 Staff 专用 API
  - `src/app/api/tickets/[id]/assign/route.ts` - 新增工单分配 API
  - `src/app/api/files/upload/route.ts` - 实现文件上传

- **状态管理**：
  - `src/lib/stores/staff-store.ts` - 创建 Staff 状态管理
  - `src/lib/stores/ticket-store.ts` - 增强工单状态管理

- **类型定义**：
  - `src/types/staff.ts` - 新增 Staff 相关类型
  - `src/types/ticket.ts` - 增强工单类型定义

### 破坏性变更
- **无** - 所有变更都是修复和增强，不会破坏现有功能
- 需要数据库迁移：添加工单分配、响应模板等表

## 优先级

**整体优先级**：🔴 P0（紧急）

由于关键功能完全不可用，此变更应立即开始实施。

## 预期收益

1. **修复关键Bug** - 恢复 Conversations 和 Tickets 核心功能
2. **提升工作效率** - 通过响应模板、工单分配减少重复工作
3. **改善用户体验** - 更流畅的工作流程和更少的错误
4. **提高客户满意度** - 更快的响应时间和更好的服务质量
5. **数据驱动决策** - 通过 KPI 和分析仪表板优化运营

## 实施时间线

- **阶段1（紧急）**：2-3天
- **阶段2（核心）**：1-2周
- **阶段3（增强）**：2-3周
- **阶段4（高级）**：3-4周

**总计**：6-9周完整实施
