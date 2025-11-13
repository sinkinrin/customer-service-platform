# Staff Portal 优化任务清单

## 阶段1：紧急Bug修复（P0）⚠️

### 1.1 修复 Conversations 页面崩溃
- [ ] 分析 `src/app/(staff)/conversations/page.tsx:108` 的错误原因
- [ ] 修复 `conversations.filter is not a function` 错误
  - 检查数据获取逻辑确保返回数组
  - 添加数组类型验证和错误边界
- [ ] 添加加载状态和错误处理
- [ ] 测试页面加载和数据显示
- [ ] 添加单元测试覆盖
- **预计时间**：4-6小时
- **优先级**：P0
- **文件**：`src/app/(staff)/conversations/page.tsx`

### 1.2 修复 Tickets 详情页路由
- [ ] 分析工单ID截断问题（60097 → 97）
- [ ] 修复路由参数解析逻辑
  - 检查 `[id]` 动态路由段
  - 确保完整工单号传递
- [ ] 更新工单列表点击处理
- [ ] 测试不同工单ID格式
- [ ] 验证URL参数正确传递
- **预计时间**：2-3小时
- **优先级**：P0
- **文件**：
  - `src/app/(staff)/tickets/page.tsx`
  - `src/app/(staff)/tickets/[id]/page.tsx`

### 1.3 创建/修复 Knowledge Base 页面
- [ ] 调查 `/staff/knowledge` 404 原因
- [ ] 创建 `src/app/(staff)/knowledge/page.tsx`
- [ ] 实现Knowledge Base浏览界面
  - 分类浏览
  - 搜索功能
  - 文章预览
- [ ] 添加Staff专属功能
  - 文章编辑建议
  - 质量评分
  - 使用统计
- [ ] 集成Zammad Knowledge Base API
- [ ] 测试页面功能和性能
- **预计时间**：8-10小时
- **优先级**：P0
- **文件**：`src/app/(staff)/knowledge/page.tsx`（新建）

### 1.4 修复 SSE 连接问题
- [ ] 分析 SSE Heartbeat timeout 错误
- [ ] 修复 `src/lib/sse/sse-client.ts` 心跳逻辑
- [ ] 实现自动重连机制
- [ ] 优化连接超时设置
- [ ] 添加连接状态指示器
- [ ] 测试长时间连接稳定性
- [ ] 添加错误日志和监控
- **预计时间**：6-8小时
- **优先级**：P0
- **文件**：
  - `src/lib/sse/sse-client.ts`
  - `src/app/api/sse/tickets/route.ts`

---

## 阶段2：核心功能完善（P1）

### 2.1 工单分配系统
- [ ] 设计工单分配数据模型
- [ ] 创建数据库迁移脚本
- [ ] 实现分配API端点
  - `POST /api/tickets/[id]/assign` - 分配工单
  - `POST /api/tickets/[id]/unassign` - 取消分配
  - `GET /api/staff/assigned-tickets` - 获取已分配工单
- [ ] 创建分配UI组件
  - Staff选择器
  - 批量分配界面
  - 分配历史记录
- [ ] 实现自动分配逻辑（可选）
  - 轮询分配
  - 负载均衡
  - 技能匹配
- [ ] 添加分配通知
- [ ] 测试分配工作流
- **预计时间**：2-3天
- **优先级**：P1
- **文件**：
  - `src/app/api/tickets/[id]/assign/route.ts`（新建）
  - `src/components/staff/ticket-assignment.tsx`（新建）
  - `src/lib/stores/ticket-store.ts`

### 2.2 响应模板系统
- [ ] 设计响应模板数据结构
- [ ] 创建模板管理API
  - `GET /api/staff/templates` - 获取模板列表
  - `POST /api/staff/templates` - 创建模板
  - `PUT /api/staff/templates/[id]` - 更新模板
  - `DELETE /api/staff/templates/[id]` - 删除模板
- [ ] 实现模板管理界面
  - 模板列表
  - 创建/编辑对话框
  - 分类管理
- [ ] 集成模板到对话界面
  - 快速插入按钮
  - 模板预览
  - 变量替换（客户名、工单号等）
- [ ] 实现模板搜索和过滤
- [ ] 添加使用统计
- [ ] 测试模板功能
- **预计时间**：3-4天
- **优先级**：P1
- **文件**：
  - `src/app/api/staff/templates/route.ts`（新建）
  - `src/components/staff/response-templates.tsx`（新建）
  - `src/lib/stores/template-store.ts`（新建）

### 2.3 对话升级工作流
- [ ] 分析当前"转人工"按钮状态
- [ ] 设计升级工作流
  - 状态转换逻辑
  - 队列管理
  - 优先级规则
- [ ] 实现升级API
  - `POST /api/conversations/[id]/escalate` - 升级对话
  - `POST /api/conversations/[id]/accept` - 接受对话
  - `GET /api/staff/pending-escalations` - 待处理升级
- [ ] 创建队列管理界面
  - 待处理列表
  - 接受/拒绝按钮
  - 优先级指示器
- [ ] 实现实时通知
  - SSE推送新升级
  - 浏览器通知
  - 声音提示
- [ ] 添加升级统计
- [ ] 测试完整升级流程
- **预计时间**：3-4天
- **优先级**：P1
- **文件**：
  - `src/app/api/conversations/[id]/escalate/route.ts`（新建）
  - `src/components/staff/escalation-queue.tsx`（新建）

### 2.4 文件上传功能
- [ ] 设计文件存储策略
  - 本地存储 vs 云存储
  - 文件路径结构
  - 安全策略
- [ ] 实现文件上传API
  - `POST /api/files/upload` - 上传文件
  - `GET /api/files/[id]` - 下载文件
  - `DELETE /api/files/[id]` - 删除文件
- [ ] 添加文件类型和大小验证
- [ ] 实现病毒扫描（可选）
- [ ] 集成到工单系统
  - 工单创建附件
  - 工单回复附件
- [ ] 集成到对话系统
  - 消息附件
  - 图片预览
- [ ] 实现文件管理界面
- [ ] 测试上传和下载功能
- **预计时间**：4-5天
- **优先级**：P1
- **文件**：
  - `src/app/api/files/upload/route.ts`
  - `src/components/file-upload.tsx`（增强）

---

## 阶段3：用户体验增强（P2）

### 3.1 Staff Dashboard KPI
- [ ] 设计KPI指标
  - 今日处理工单数
  - 平均响应时间
  - 客户满意度
  - 在线时长
- [ ] 创建KPI API端点
  - `GET /api/staff/dashboard/kpi` - 获取KPI数据
  - `GET /api/staff/dashboard/charts` - 获取图表数据
- [ ] 实现Dashboard组件
  - 统计卡片
  - 趋势图表
  - 排行榜
- [ ] 添加日期范围选择器
- [ ] 实现数据导出功能
- [ ] 优化查询性能
- [ ] 测试数据准确性
- **预计时间**：3-4天
- **优先级**：P2
- **文件**：
  - `src/app/(staff)/dashboard/page.tsx`（增强）
  - `src/components/staff/kpi-dashboard.tsx`（新建）

### 3.2 队列管理系统
- [ ] 设计队列数据结构
- [ ] 实现队列API
  - `GET /api/staff/queues` - 获取队列列表
  - `POST /api/staff/queues/[id]/join` - 加入队列
  - `POST /api/staff/queues/[id]/leave` - 离开队列
- [ ] 创建队列管理界面
  - 队列状态显示
  - 等待数量
  - 平均等待时间
- [ ] 实现队列分配逻辑
- [ ] 添加队列优先级
- [ ] 实现实时更新
- [ ] 测试队列功能
- **预计时间**：3-4天
- **优先级**：P2
- **文件**：
  - `src/app/api/staff/queues/route.ts`（新建）
  - `src/components/staff/queue-management.tsx`（新建）

### 3.3 客户详情侧边栏
- [ ] 设计侧边栏布局
- [ ] 实现客户信息API
  - `GET /api/customers/[id]/profile` - 客户资料
  - `GET /api/customers/[id]/history` - 历史记录
  - `GET /api/customers/[id]/tickets` - 相关工单
- [ ] 创建侧边栏组件
  - 基本信息卡片
  - 历史记录时间线
  - 快速操作按钮
- [ ] 实现上下文加载
- [ ] 添加编辑功能
- [ ] 优化加载性能
- [ ] 测试侧边栏功能
- **预计时间**：2-3天
- **优先级**：P2
- **文件**：
  - `src/components/staff/customer-sidebar.tsx`（新建）
  - `src/app/api/customers/[id]/route.ts`

### 3.4 批量操作功能
- [ ] 设计批量操作UI
- [ ] 实现工单多选
- [ ] 创建批量操作API
  - `POST /api/tickets/bulk/assign` - 批量分配
  - `POST /api/tickets/bulk/update-status` - 批量更新状态
  - `POST /api/tickets/bulk/add-tag` - 批量添加标签
- [ ] 实现批量操作界面
  - 选择工具栏
  - 操作菜单
  - 确认对话框
- [ ] 添加操作日志
- [ ] 实现撤销功能
- [ ] 测试批量操作
- **预计时间**：2-3天
- **优先级**：P2
- **文件**：
  - `src/app/api/tickets/bulk/route.ts`（新建）
  - `src/components/staff/bulk-operations.tsx`（新建）

### 3.5 Staff个人设置
- [ ] 设计设置页面布局
- [ ] 实现设置API
  - `GET /api/staff/settings` - 获取设置
  - `PUT /api/staff/settings` - 更新设置
- [ ] 创建设置界面
  - 个人资料
  - 通知偏好
  - 界面偏好
  - 快捷键配置
- [ ] 实现设置验证
- [ ] 添加设置同步
- [ ] 测试设置功能
- **预计时间**：2-3天
- **优先级**：P2
- **文件**：
  - `src/app/(staff)/settings/page.tsx`（新建）
  - `src/app/api/staff/settings/route.ts`（新建）

---

## 阶段4：高级功能（P3）

### 4.1 技能路由系统
- [ ] 设计技能模型
- [ ] 创建技能管理API
- [ ] 实现技能匹配算法
- [ ] 创建技能配置界面
- [ ] 集成到工单分配
- [ ] 测试路由准确性
- **预计时间**：4-5天
- **优先级**：P3

### 4.2 性能分析仪表板
- [ ] 设计性能指标
- [ ] 实现数据收集
- [ ] 创建分析报表
- [ ] 添加可视化图表
- [ ] 实现趋势分析
- [ ] 测试报表准确性
- **预计时间**：4-5天
- **优先级**：P3

### 4.3 工单模板系统
- [ ] 设计模板结构
- [ ] 实现模板管理
- [ ] 创建模板库
- [ ] 添加变量系统
- [ ] 集成到工单创建
- [ ] 测试模板功能
- **预计时间**：3-4天
- **优先级**：P3

### 4.4 排班管理
- [ ] 设计排班模型
- [ ] 实现排班API
- [ ] 创建排班界面
- [ ] 添加日历视图
- [ ] 实现班次管理
- [ ] 测试排班功能
- **预计时间**：4-5天
- **优先级**：P3

---

## 测试与质量保证

### 单元测试
- [ ] Conversations 页面组件测试
- [ ] Tickets 路由测试
- [ ] API 端点测试
- [ ] 工具函数测试

### 集成测试
- [ ] 工单分配流程测试
- [ ] 对话升级流程测试
- [ ] 文件上传流程测试
- [ ] SSE 连接测试

### E2E测试
- [ ] Playwright 完整工作流测试
- [ ] 多用户并发测试
- [ ] 性能基准测试

### 用户验收测试
- [ ] Staff 用户测试
- [ ] 功能验收
- [ ] 性能验收

---

## 里程碑

| 里程碑 | 完成标准 | 预计日期 |
|--------|---------|---------|
| M1: 紧急修复完成 | 所有P0 Bug修复，核心功能可用 | 第1周 |
| M2: 核心功能上线 | 工单分配、响应模板、文件上传完成 | 第3周 |
| M3: 体验优化完成 | Dashboard、队列、批量操作完成 | 第6周 |
| M4: 高级功能上线 | 技能路由、性能分析完成 | 第9周 |

---

## 成功指标

- [ ] 所有P0 Bug已修复
- [ ] Conversations页面加载成功率 100%
- [ ] Tickets路由错误率 < 0.1%
- [ ] SSE连接稳定性 > 99%
- [ ] Staff工作效率提升 > 30%
- [ ] 响应时间减少 > 40%
- [ ] 用户满意度 > 4.5/5.0
