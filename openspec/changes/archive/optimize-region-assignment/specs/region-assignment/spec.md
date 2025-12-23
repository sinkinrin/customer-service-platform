# Region Assignment System Specification

## Overview

本规范定义了客服平台的地区分配系统，确保对话和工单能够正确路由到对应区域的客服人员。

---

## ADDED Requirements

### Requirement: Conversation Region Field

系统 SHALL 为每个对话存储所属地区（region）字段。

#### Scenario: 客户创建新对话时自动设置地区
- **GIVEN** 客户已登录且其账户有 region 字段
- **WHEN** 客户创建新的 AI 对话
- **THEN** 对话的 region 字段 SHALL 自动设置为客户的 region 值

#### Scenario: 对话地区字段持久化
- **GIVEN** 一个已创建的对话
- **WHEN** 系统重启或数据重新加载
- **THEN** 对话的 region 字段 SHALL 保持不变

---

### Requirement: Region-based Conversation Routing

系统 SHALL 根据对话的地区将转人工请求路由到对应区域的客服队列。

#### Scenario: 客户转人工时对话进入区域队列
- **GIVEN** 客户正在进行 AI 对话
- **AND** 客户的 region 为 "asia-pacific"
- **WHEN** 客户请求转接人工客服
- **THEN** 对话 SHALL 进入 "asia-pacific" 区域的待处理队列
- **AND** 对话状态 SHALL 变为 "waiting"

#### Scenario: 转人工后显示区域信息
- **GIVEN** 客户请求转接人工客服
- **WHEN** 转接成功
- **THEN** 系统 SHALL 显示"您的请求已转接至 [区域名称] 的客服团队"

---

### Requirement: Staff Region-based Access Control

Staff 用户 SHALL 只能访问其所属区域的对话。

#### Scenario: Staff 查看对话列表
- **GIVEN** Staff 用户已登录
- **AND** Staff 的 region 为 "europe-zone-1"
- **WHEN** Staff 访问对话列表页面
- **THEN** 系统 SHALL 只显示 region 为 "europe-zone-1" 的对话

#### Scenario: Staff 尝试访问其他区域对话
- **GIVEN** Staff 用户的 region 为 "asia-pacific"
- **AND** 存在一个 region 为 "europe-zone-1" 的对话
- **WHEN** Staff 尝试直接访问该对话的详情页
- **THEN** 系统 SHALL 返回 403 Forbidden 错误

#### Scenario: Staff 对话列表显示区域提示
- **GIVEN** Staff 用户已登录
- **WHEN** Staff 查看对话列表
- **THEN** 页面 SHALL 显示"显示 [区域名称] 的对话"提示

---

### Requirement: Admin Full Region Access

Admin 用户 SHALL 能够访问所有区域的对话。

#### Scenario: Admin 查看全部对话
- **GIVEN** Admin 用户已登录
- **WHEN** Admin 访问对话列表页面
- **THEN** 系统 SHALL 显示所有区域的对话

#### Scenario: Admin 按区域筛选对话
- **GIVEN** Admin 用户已登录
- **AND** 存在多个区域的对话
- **WHEN** Admin 选择筛选 "middle-east" 区域
- **THEN** 系统 SHALL 只显示 region 为 "middle-east" 的对话

---

### Requirement: Cross-region Conversation Reassignment

Admin 用户 SHALL 能够将对话转移到其他区域。

#### Scenario: Admin 转移对话到其他区域
- **GIVEN** Admin 用户已登录
- **AND** 存在一个 region 为 "asia-pacific" 的对话
- **WHEN** Admin 将该对话转移到 "europe-zone-1"
- **THEN** 对话的 region SHALL 更新为 "europe-zone-1"
- **AND** 系统 SHALL 记录转移原因和时间

#### Scenario: Staff 无法转移对话到其他区域
- **GIVEN** Staff 用户已登录
- **AND** 存在一个属于该 Staff 区域的对话
- **WHEN** Staff 尝试将对话转移到其他区域
- **THEN** 系统 SHALL 返回 403 Forbidden 错误

#### Scenario: 跨区域转移后原区域 Staff 无法访问
- **GIVEN** 一个对话从 "asia-pacific" 转移到 "europe-zone-1"
- **AND** Staff A 的 region 为 "asia-pacific"
- **WHEN** Staff A 尝试访问该对话
- **THEN** 系统 SHALL 返回 403 Forbidden 错误

---

### Requirement: Region Display in UI

系统 SHALL 在相关 UI 界面清晰显示对话和工单的所属区域。

#### Scenario: 对话列表显示区域标签
- **GIVEN** Staff 或 Admin 用户查看对话列表
- **WHEN** 列表中有多个对话
- **THEN** 每个对话项 SHALL 显示其所属区域的标签

#### Scenario: 对话详情页显示区域信息
- **GIVEN** 用户查看对话详情页
- **WHEN** 页面加载完成
- **THEN** 页面头部 SHALL 显示该对话的所属区域

#### Scenario: 转人工对话框显示目标区域
- **GIVEN** 客户点击"转人工"按钮
- **WHEN** 转人工对话框打开
- **THEN** 对话框 SHALL 显示"将转接至 [区域名称] 的客服"

---

### Requirement: Region Statistics for Admin

Admin Dashboard SHALL 显示按区域统计的对话数据。

#### Scenario: Admin 查看区域对话统计
- **GIVEN** Admin 用户访问 Dashboard
- **WHEN** 页面加载完成
- **THEN** 页面 SHALL 显示每个区域的：
  - 活跃对话数
  - 等待处理对话数
  - 今日新增对话数

#### Scenario: 区域统计实时更新
- **GIVEN** Admin 正在查看 Dashboard
- **WHEN** 有新对话创建或状态变更
- **THEN** 区域统计数据 SHALL 在合理时间内更新（≤30秒）

---

### Requirement: Legacy Conversation Migration

系统 SHALL 支持为现有对话迁移添加 region 字段。

#### Scenario: 迁移脚本为旧对话添加 region
- **GIVEN** 存在没有 region 字段的旧对话
- **AND** 该对话的 customer_email 对应的用户有 region
- **WHEN** 运行迁移脚本
- **THEN** 对话的 region SHALL 设置为该用户的 region

#### Scenario: 迁移脚本处理未知用户
- **GIVEN** 存在没有 region 字段的旧对话
- **AND** 无法找到该 customer_email 对应的用户 region
- **WHEN** 运行迁移脚本
- **THEN** 对话的 region SHALL 设置为默认值 "asia-pacific"

#### Scenario: 迁移脚本生成报告
- **WHEN** 迁移脚本执行完成
- **THEN** 脚本 SHALL 输出：
  - 总处理对话数
  - 成功迁移数
  - 使用默认值数
  - 失败数（如有）

---

## Technical Notes

### Region Values
系统支持的 region 值（来自 `regions.ts`）：
- `asia-pacific`
- `middle-east`
- `africa`
- `north-america`
- `latin-america`
- `europe-zone-1`
- `europe-zone-2`
- `cis`

### Data Model Changes
```typescript
interface LocalConversation {
  // ... existing fields
  region: RegionValue      // 新增：必需字段
  assigned_at?: string     // 新增：可选字段
}
```

### API Changes
- `GET /api/conversations` - 添加 region 过滤逻辑
- `POST /api/conversations` - 自动设置 region
- `POST /api/conversations/[id]/transfer` - 继承客户 region
- `POST /api/conversations/[id]/reassign-region` - 新增端点
