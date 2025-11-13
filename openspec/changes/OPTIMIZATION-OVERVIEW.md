# Customer Service Platform 优化总览

本文档提供了Staff Portal和Customer Portal完整优化计划的概述。

## 📋 执行摘要

基于2025年11月12日的全面代码审查和实际用户测试（使用Playwright），我们识别出了两个门户的多个关键Bug和功能缺失。本优化计划旨在系统地修复这些问题并增强用户体验。

### 关键发现

| 门户 | 完成度 | 关键问题 | 优先级 |
|------|--------|---------|--------|
| **Staff Portal** | ~60% | Conversations崩溃、Tickets路由错误、Knowledge Base缺失 | 🔴 P0 |
| **Customer Portal** | ~75% | 工单路由错误、列表为空、文件上传未实现 | 🟡 P1 |

### 影响范围

- **代码文件**：~50+ 个文件需要修改/创建
- **API端点**：~20+ 个新API需要实现
- **数据库表**：~10+ 个表需要创建/修改
- **预计时间**：6-9周全面实施

---

## 🎯 优化目标

### 短期目标（1-2周）
1. 修复所有P0关键Bug
2. 恢复核心功能可用性
3. 确保基本用户旅程顺畅

### 中期目标（3-6周）
1. 实现核心功能增强
2. 完善文件上传系统
3. 实现工单分配和响应模板
4. 完成FAQ评分系统

### 长期目标（7-9周）
1. 实现高级功能
2. 优化性能和用户体验
3. 添加智能推荐和分析
4. 完善通知系统

---

## 📂 项目结构

```
openspec/changes/
├── staff-portal-optimization/          # Staff Portal优化
│   ├── proposal.md                     # 变更提案
│   ├── tasks.md                        # 详细任务清单
│   └── specs/
│       └── technical-spec.md           # 技术规范
│
├── customer-portal-optimization/       # Customer Portal优化
│   ├── proposal.md                     # 变更提案
│   ├── tasks.md                        # 详细任务清单
│   └── specs/
│       └── technical-spec.md           # 技术规范
│
└── OPTIMIZATION-OVERVIEW.md            # 本文档
```

---

## 🔴 Staff Portal 优化

### 核心问题

1. **Conversations页面崩溃** (P0)
   - 错误：`TypeError: conversations.filter is not a function`
   - 位置：`src/app/(staff)/conversations/page.tsx:108`
   - 影响：Staff无法管理客户对话

2. **Tickets路由错误** (P0)
   - 问题：工单ID从60097截断为97
   - URL：`/staff/tickets/97` → 404
   - 影响：无法查看工单详情

3. **Knowledge Base缺失** (P0)
   - URL：`/staff/knowledge` → 404
   - 影响：Staff无法浏览知识库

4. **SSE连接不稳定** (P0)
   - 错误：Heartbeat timeout
   - 影响：实时更新失效

### 优化计划

#### 阶段1：紧急修复 (2-3天)
- [x] 分析Bug原因
- [ ] 修复Conversations页面
- [ ] 修复Tickets路由
- [ ] 创建Knowledge Base页面
- [ ] 修复SSE连接

#### 阶段2：核心功能 (1-2周)
- [ ] 工单分配系统
- [ ] 响应模板系统
- [ ] 对话升级工作流
- [ ] 文件上传功能

#### 阶段3：体验增强 (2-3周)
- [ ] Staff Dashboard KPI
- [ ] 队列管理系统
- [ ] 客户详情侧边栏
- [ ] 批量操作功能
- [ ] Staff个人设置

#### 阶段4：高级功能 (3-4周)
- [ ] 技能路由系统
- [ ] 性能分析仪表板
- [ ] 工单模板系统
- [ ] 排班管理

### 关键指标

- [ ] Conversations加载成功率 = 100%
- [ ] Tickets路由错误率 < 0.1%
- [ ] SSE连接稳定性 > 99%
- [ ] Staff工作效率提升 > 30%

[详细信息 →](./staff-portal-optimization/)

---

## 🟡 Customer Portal 优化

### 核心问题

1. **工单路由错误** (P0)
   - 问题：跳转到`/staff/tickets/{id}`而非`/my-tickets/{id}`
   - 位置：`src/app/(customer)/my-tickets/page.tsx:173,200`
   - 影响：客户无法查看工单详情

2. **工单列表为空** (P1)
   - 显示："共 0 个工单"
   - 可能原因：Zammad用户映射错误
   - 影响：客户看不到自己的工单

3. **文件上传未实现** (P1)
   - TODO：`src/app/(customer)/my-tickets/create/page.tsx:85`
   - 影响：无法提交附件

4. **FAQ评分系统不完整** (P1)
   - 问题：只显示数据，无法交互
   - 影响：无法收集用户反馈

### 优化计划

#### 阶段1：紧急修复 (2-3天)
- [x] 分析Bug原因
- [ ] 修复工单路由
- [ ] 解决工单列表为空
- [ ] 修复FAQ交互
- [ ] 解决SSE连接

#### 阶段2：核心功能 (1-2周)
- [ ] 实现文件上传（后端+前端）
- [ ] 完善工单管理
- [ ] 实现FAQ评分系统
- [ ] 增强对话功能

#### 阶段3：体验增强 (2-3周)
- [ ] 优化Dashboard个性化
- [ ] 实现通知中心
- [ ] 添加帮助引导
- [ ] 实现服务预约
- [ ] 添加多渠道通知

#### 阶段4：自助服务 (3-4周)
- [ ] 智能FAQ推荐
- [ ] 问题诊断向导
- [ ] 客户社区功能
- [ ] 自助问题解决
- [ ] 满意度调查

### 关键指标

- [ ] 工单路由错误率 < 0.1%
- [ ] 文件上传成功率 > 99%
- [ ] FAQ评分参与率 > 30%
- [ ] 自助解决率提升 > 40%

[详细信息 →](./customer-portal-optimization/)

---

## 🔄 协同优化

某些功能需要两个Portal协同实施：

### 文件上传系统
- **共用组件**：`src/components/file-upload.tsx`
- **共用API**：`src/app/api/files/upload/route.ts`
- **共用存储**：统一文件存储策略

### 实时通知系统
- **共用基础**：SSE基础设施
- **共用API**：`src/app/api/sse/`
- **双向通信**：Staff ↔ Customer

### 工单系统
- **数据一致性**：确保两端数据同步
- **状态同步**：工单状态实时更新
- **权限控制**：各端查看权限不同

---

## 📊 实施时间表

```
Week 1-2  │ 紧急Bug修复阶段
          ├─ Staff: 修复Conversations, Tickets, KB, SSE
          └─ Customer: 修复路由、工单列表、FAQ

Week 3-4  │ 核心功能阶段 (并行)
          ├─ Staff: 工单分配、响应模板
          └─ Customer: 文件上传、工单管理

Week 5-6  │ 核心功能阶段 (并行)
          ├─ Staff: 对话升级、文件上传
          └─ Customer: FAQ评分、对话增强

Week 7-8  │ 体验增强阶段
          ├─ Staff: Dashboard、队列、批量操作
          └─ Customer: 通知中心、帮助引导

Week 9-10 │ 高级功能阶段
          ├─ Staff: 技能路由、性能分析
          └─ Customer: 智能推荐、诊断向导

Week 11   │ 测试与优化
          ├─ 完整E2E测试
          ├─ 性能优化
          └─ 用户验收测试

Week 12   │ 发布准备
          ├─ 生产部署
          ├─ 监控告警
          └─ 文档更新
```

---

## 🎯 成功标准

### 技术指标

#### 功能完整性
- [ ] 所有P0 Bug已修复
- [ ] 核心功能100%可用
- [ ] 新功能覆盖率 > 90%

#### 性能指标
- [ ] 页面加载时间 < 2秒
- [ ] API响应时间 < 500ms
- [ ] SSE连接稳定性 > 99%

#### 质量指标
- [ ] 单元测试覆盖率 > 80%
- [ ] E2E测试覆盖关键流程
- [ ] 错误率 < 0.5%

### 业务指标

#### Staff Portal
- [ ] 工作效率提升 > 30%
- [ ] 响应时间减少 > 40%
- [ ] 用户满意度 > 4.5/5.0

#### Customer Portal
- [ ] 自助解决率提升 > 40%
- [ ] 人工咨询减少 > 30%
- [ ] 客户满意度 > 4.5/5.0
- [ ] FAQ使用率提升 > 50%

---

## 🚀 开始实施

### 准备工作

1. **环境设置**
   ```bash
   # 克隆仓库
   git clone <repo-url>
   cd customer-service-platform

   # 安装依赖
   npm install

   # 设置环境变量
   cp .env.example .env.local
   ```

2. **创建开发分支**
   ```bash
   # Staff Portal优化
   git checkout -b feature/staff-portal-optimization

   # Customer Portal优化
   git checkout -b feature/customer-portal-optimization
   ```

3. **数据库准备**
   ```bash
   # 运行迁移脚本
   npm run db:migrate
   ```

### 开发流程

1. **选择任务** - 从tasks.md选择待办任务
2. **实现功能** - 按照technical-spec.md实现
3. **编写测试** - 单元测试 + 集成测试
4. **代码审查** - 提交PR等待审查
5. **测试验证** - QA测试验证
6. **合并部署** - 合并到主分支

### 监控与反馈

1. **每日站会** - 同步进度和阻碍
2. **周报** - 汇报完成情况和下周计划
3. **里程碑评审** - 每个阶段结束评审
4. **用户反馈** - 收集用户使用反馈

---

## 📚 相关文档

- [Staff Portal 优化提案](./staff-portal-optimization/proposal.md)
- [Staff Portal 任务清单](./staff-portal-optimization/tasks.md)
- [Staff Portal 技术规范](./staff-portal-optimization/specs/technical-spec.md)
- [Customer Portal 优化提案](./customer-portal-optimization/proposal.md)
- [Customer Portal 任务清单](./customer-portal-optimization/tasks.md)
- [Customer Portal 技术规范](./customer-portal-optimization/specs/technical-spec.md)
- [测试报告](../../TEST-RESULTS.md)
- [项目指南](../../CLAUDE.md)

---

## 💬 联系方式

如有问题或建议，请联系：
- 技术负责人：[待指定]
- Product Owner：[待指定]
- QA负责人：[待指定]

---

## 📝 更新记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2025-11-12 | 1.0.0 | 创建初始版本 | Claude Code |

---

**状态**: 📋 规划完成，待开始实施
**下一步**: 开发团队评审并确认实施计划
