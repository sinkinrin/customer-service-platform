# 变更：修复2026年1月用户反馈问题

## 原因

2026年1月14日收集到的用户反馈中发现 **14 个问题**，涉及权限控制、UI/UX、性能优化和功能完善等多个方面。本提案整合所有反馈问题，按优先级分阶段实施修复。

### 核心问题分类

1. **权限/安全问题（P0）** - 4个
   - Staff跨区可见工单数量统计
   - 未启用Customer对Staff可见
   - Webhook刷新影响所有Staff
   - Admin账号参与自动分配

2. **功能缺陷（P1）** - 4个
   - Email HTML解析失效
   - 附件格式支持不完整
   - 个人设置功能未完善
   - 工单创建速度慢

3. **用户体验问题（P2）** - 6个
   - 附件UI文字不清晰
   - 单行文本显示不全
   - 工单评价展示不明显
   - 工单详情不自动滚动到最新
   - Pending状态用途不清晰
   - 工单模板需精简

## 变更内容

### 阶段 1：权限与安全修复（P0）

#### 1.1 Staff跨区数据隔离
- **问题**: Staff可以看到其他区域的工单数量统计
- **修复**: 
  - 为Staff角色创建独立的统计API
  - 所有工单相关API统一使用 `filterTicketsByPermission()` 过滤
  - Staff Dashboard只显示本区域数据

#### 1.2 Customer激活状态过滤
- **问题**: 未启用的Customer在Staff客户列表中可见
- **修复**: 
  - 在客户列表API和前端增加 `active=true` 过滤

#### 1.3 Webhook定向推送
- **问题**: Webhook触发时所有Staff界面都刷新
- **修复**: 
  - SSE发射器根据工单owner_id和group_id过滤接收用户
  - 只向相关Staff发送更新事件

#### 1.4 Admin账号排除自动分配
- **问题**: Admin账号可能被自动分配工单
- **修复**: 
  - 在自动分配逻辑中按角色排除Admin用户

### 阶段 2：功能修复（P1）

#### 2.1 Email HTML模板修复
- **问题**: 邮件通知显示原始HTML标签
- **修复**: 
  - 设计正确的HTML邮件模板
  - 明确指定content_type

#### 2.2 附件格式扩展
- **问题**: 不支持zip、wmv等常用格式
- **修复**: 
  - 扩展 `accept` 属性支持更多格式
  - 添加 `.zip,.rar,.7z,.mp4,.wmv,.avi,.mov`

#### 2.3 个人设置功能实现
- **问题**: 设置保存只是模拟调用
- **修复**: 
  - 实现 `PUT /api/user/profile` API
  - 实现 `PUT /api/user/preferences` API
  - 实现 `PUT /api/user/password` API

#### 2.4 工单创建性能优化
- **问题**: 带附件时创建过慢
- **修复**: 
  - 分离附件上传流程
  - 增加上传进度显示
  - 优化Zammad用户验证缓存

### 阶段 3：用户体验优化（P2）

#### 3.1 附件UI改进
- 增强附件文字对比度
- 添加完整文件名tooltip

#### 3.2 文本显示优化
- 长文本使用 `break-words` 换行
- 添加tooltip显示完整内容

#### 3.3 工单评价展示增强
- 在工单详情顶部显示评价状态
- 在工单列表显示评价图标
- Dashboard展示评价统计

#### 3.4 工单详情自动滚动
- 加载后自动滚动到最新消息

#### 3.5 Pending状态说明
- 添加状态用途tooltip说明
- 完善帮助文档

#### 3.6 工单模板优化
- 添加模板变量支持
- 支持快捷键插入

### 阶段 4：扩展功能（P3）

#### 4.1 区域内客户-Staff对应
- 新建 `CustomerStaffAssignment` 数据模型
- 实现绑定管理界面
- 自动分配时优先使用绑定关系

## 影响

### 受影响的规范
- `ticket-permission` - 工单权限控制
- `user-settings` - 用户设置
- `notification-system` - 通知系统
- `ticket-ui` - 工单界面

### 受影响的代码

| 模块 | 文件 | 变更类型 |
|------|------|----------|
| 权限 | `src/lib/utils/permission.ts` | 增强过滤逻辑 |
| 权限 | `src/app/api/admin/stats/*` | 添加Staff区域过滤 |
| 用户 | `src/app/staff/customers/page.tsx` | 过滤inactive用户 |
| Webhook | `src/lib/sse/emitter.ts` | 定向推送 |
| 分配 | `src/app/api/tickets/auto-assign/route.ts` | 排除Admin |
| Email | `scripts/setup-email-triggers.ts` | HTML模板 |
| 附件 | `src/components/ticket/ticket-actions.tsx` | 扩展格式 |
| 附件 | `src/components/ticket/article-content.tsx` | UI优化 |
| 设置 | `src/app/customer/settings/page.tsx` | 实现API调用 |
| 设置 | `src/app/api/user/*` | 新增API |
| 工单 | `src/app/*/tickets/[id]/page.tsx` | 自动滚动 |
| 评价 | `src/components/ticket/ticket-rating.tsx` | 展示优化 |

### 数据库变更
- 可能新增 `CustomerStaffAssignment` 表（阶段4）

## 测试反馈来源
- 反馈日期：2026/01/14
- 分析文档：`docs/feedback-analysis-2026-01-14.md`

## 验收标准

### P0 验收
1. Staff无法看到跨区域工单数量统计
2. Staff客户列表不显示inactive用户
3. Webhook更新只推送给相关Staff
4. Admin账号不会被自动分配工单

### P1 验收
1. 邮件通知正确渲染HTML格式
2. 支持zip/wmv等文件格式上传
3. 个人设置修改能正确保存
4. 工单创建时间合理（<3秒无附件）

### P2 验收
1. 附件文字清晰可读
2. 长文本有tooltip或换行显示
3. 工单评价在详情页明显展示
4. 打开工单详情自动定位到最新消息
