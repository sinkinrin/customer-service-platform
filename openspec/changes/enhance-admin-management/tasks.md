# 任务清单：完善Admin管理功能

## 1. 看板功能增强

### 1.1 数据统计API
- [ ] 1.1.1 创建 `src/app/api/admin/stats/tickets/route.ts` - 工单趋势统计
- [ ] 1.1.2 创建 `src/app/api/admin/stats/staff/route.ts` - 员工绩效统计
- [ ] 1.1.3 创建 `src/app/api/admin/stats/satisfaction/route.ts` - 客户满意度统计
- [ ] 1.1.4 创建 `src/app/api/admin/stats/system/route.ts` - 系统健康状态
- **预计时间**：2天
- **优先级**：P1

### 1.2 图表组件
- [ ] 1.2.1 创建 `src/components/admin/charts/ticket-trend-chart.tsx` - 工单趋势图
- [ ] 1.2.2 创建 `src/components/admin/charts/staff-performance-chart.tsx` - 员工绩效图
- [ ] 1.2.3 创建 `src/components/admin/charts/satisfaction-chart.tsx` - 满意度图表
- [ ] 1.2.4 创建 `src/components/admin/charts/region-distribution-chart.tsx` - 地区分布图
- **预计时间**：2-3天
- **优先级**：P1

### 1.3 Dashboard增强
- [ ] 1.3.1 更新 `src/app/admin/dashboard/page.tsx` 集成图表组件
- [ ] 1.3.2 添加实时刷新功能
- [ ] 1.3.3 添加时间范围选择器
- [ ] 1.3.4 实现响应式布局优化
- **预计时间**：1-2天
- **优先级**：P1

## 2. 账号管理完善

### 2.1 账号创建增强
- [ ] 2.1.1 增强 `src/app/admin/users/create/page.tsx` 表单校验
- [ ] 2.1.2 添加邮箱唯一性检查
- [ ] 2.1.3 添加密码强度检测
- [ ] 2.1.4 实现创建后发送欢迎邮件选项
- **预计时间**：1天
- **优先级**：P1

### 2.2 批量导入
- [ ] 2.2.1 创建 `src/app/api/admin/users/import/route.ts`
- [ ] 2.2.2 创建 `src/components/admin/user-import-dialog.tsx`
- [ ] 2.2.3 实现CSV/Excel解析
- [ ] 2.2.4 添加导入预览和错误提示
- [ ] 2.2.5 实现导入进度显示
- **预计时间**：2-3天
- **优先级**：P1

### 2.3 账号导出
- [ ] 2.3.1 创建 `src/app/api/admin/users/export/route.ts`
- [ ] 2.3.2 支持导出为CSV格式
- [ ] 2.3.3 支持导出为Excel格式
- [ ] 2.3.4 添加导出字段选择
- **预计时间**：1天
- **优先级**：P2

### 2.4 账号状态管理
- [ ] 2.4.1 创建 `src/app/api/admin/users/[id]/status/route.ts`
- [ ] 2.4.2 实现激活/禁用用户功能
- [ ] 2.4.3 更新用户列表显示状态标签
- [ ] 2.4.4 添加状态变更确认弹窗
- **预计时间**：1天
- **优先级**：P1

### 2.5 密码重置
- [ ] 2.5.1 创建 `src/app/api/admin/users/[id]/reset-password/route.ts`
- [ ] 2.5.2 添加重置密码按钮到用户操作
- [ ] 2.5.3 发送密码重置邮件
- **预计时间**：0.5天
- **优先级**：P2

## 3. 用户管理增强

### 3.1 用户详情页
- [ ] 3.1.1 创建 `src/app/admin/users/[id]/page.tsx`
- [ ] 3.1.2 显示用户基本信息
- [ ] 3.1.3 显示用户活动历史
- [ ] 3.1.4 显示关联工单/对话
- **预计时间**：2天
- **优先级**：P2

### 3.2 用户编辑
- [ ] 3.2.1 创建 `src/app/admin/users/[id]/edit/page.tsx`
- [ ] 3.2.2 实现基本信息编辑
- [ ] 3.2.3 实现角色变更
- [ ] 3.2.4 实现地区变更
- **预计时间**：1天
- **优先级**：P2

### 3.3 用户列表区域展示
- [ ] 3.3.1 更新 `User` 类型定义添加 region 字段
- [ ] 3.3.2 更新 GET `/api/admin/users` 返回 region 字段
- [ ] 3.3.3 在用户列表表格添加区域列
- [ ] 3.3.4 区域显示本地化标签
- **预计时间**：0.5天
- **优先级**：P0

### 3.4 搜索筛选增强
- [ ] 3.4.1 更新用户列表添加高级筛选
- [ ] 3.4.2 添加按地区筛选
- [ ] 3.4.3 添加按状态筛选
- [ ] 3.4.4 添加按创建时间筛选
- **预计时间**：1天
- **优先级**：P1

## 4. 系统配置管理

### 4.1 设置页面
- [ ] 4.1.1 创建 `src/app/admin/settings/page.tsx`
- [ ] 4.1.2 创建系统配置表单
- [ ] 4.1.3 创建 `src/app/api/admin/settings/route.ts`
- **预计时间**：2天
- **优先级**：P2

### 4.2 工单配置
- [ ] 4.2.1 实现优先级配置
- [ ] 4.2.2 实现状态配置
- [ ] 4.2.3 实现分类配置
- **预计时间**：1天
- **优先级**：P3

## 5. 测试验证

- [ ] 5.1 Dashboard图表功能测试
- [ ] 5.2 用户创建和导入测试
- [ ] 5.3 用户状态管理测试
- [ ] 5.4 设置保存和加载测试
- **预计时间**：2天
