# 变更：增强Ticket系统功能

## 原因
2025年12月19日用户测试反馈中收集了18+条功能改进建议，这些功能将显著提升工单系统的用户体验和工作效率。本提案整合所有功能建议，按优先级分阶段实施。

## 变更内容

### P1 - 核心功能增强
- 添加工单评价系统（好评/差评及理由）
- 添加工单重新激活功能
- 添加回复模板功能
- 支持工单按优先级排序/筛选
- 添加工单导出功能（Admin全部/Staff各自）

### P2 - 用户体验优化
- 工单详情页布局优化（状态信息靠右，对话居中，AI摘要置顶）
- 员工和客户消息用不同底色区分
- 客户管理界面工单历史弹窗预览
- 工单REASSIGN统一入口
- 用户头像上传功能

### P3 - 智能化功能
- 工单/对话AI概要功能
- AI知识库机型模糊匹配优化
- 工单SLA时效管理和提醒
- 工单状态变更自动邮件通知

### P4 - 扩展功能
- 工单提交引导表单（设备信息、问题日期等）
- 未注册用户邮件注册流程
- 识别工单用户注册状态
- FAQ批量导入导出
- 邮件模板配置（签名、URL、联系方式）

### 暂缓功能
- **BREAKING** Business Type功能暂时隐藏

## 影响

### 受影响的规范
- `ticket-system` - 工单管理核心功能
- `user-settings` - 用户Profile设置
- `faq-system` - FAQ管理
- `email-notification` - 邮件通知（需创建）

### 受影响的代码
- **前端组件**：
  - `src/app/*/tickets/` - 工单相关页面
  - `src/components/ticket/` - 工单组件
  - `src/app/admin/` - Admin管理页面
  - `src/components/ui/` - 通用UI组件

- **后端API**：
  - `src/app/api/tickets/` - 工单API
  - `src/app/api/admin/` - Admin API
  - `src/app/api/templates/` - 模板API（新建）
  - `src/app/api/export/` - 导出API（新建）

- **数据库**：
  - 添加ticket_ratings表
  - 添加reply_templates表
  - 添加sla_rules表

## 测试反馈来源
- 反馈日期：2025/12/19
- 反馈人：Jason, Archer, Cody, Dover, SHAMY, Kevin
- 原始文件：AI智能服务反馈—Ticket系统测试-工作表1.csv
