# 改进 Conversation 转人工功能 - 实施任务清单

## 概述
本文档列出实施"改进 Conversation 转人工功能"所需的所有任务。任务分为4个阶段，每个阶段都可以独立测试和部署。

**预计总工期**: 5-7 个工作日
**优先级**: 高

---

## 阶段 1: 核心转人工功能 (1-2 天)

### 后端 API 实现

- [x] **Task 1.1**: 创建转人工 API endpoint
  - 文件: `src/app/api/conversations/[id]/transfer/route.ts`
  - 功能:
    - [x] 验证用户权限（必须是对话的 customer）
    - [x] 验证对话状态（mode 必须是 'ai'，status 必须是 'active'）
    - [x] 更新 conversation mode 从 'ai' 到 'human'
    - [x] 设置 `transferred_at` 时间戳
    - [x] 保存 `transfer_reason`（如果提供）
    - [x] 返回更新后的 conversation 对象
  - 测试:
    - [x] 单元测试：验证状态转换逻辑
    - [x] 集成测试：完整转人工流程
    - [x] 错误处理：重复转人工、无权限等

- [x] **Task 1.2**: 保存 AI 对话历史为系统消息
  - 文件: `src/app/api/conversations/[id]/transfer/route.ts`
  - 功能:
    - [x] 接收前端传来的 AI 对话历史 (`aiHistory`)
    - [x] 创建 `transfer_history` 类型的消息
    - [x] 消息 metadata 包含完整的 AI 历史
    - [x] sender_role 设为 'system'
    - [x] 保存到 `messages.json`
  - 测试:
    - [x] 验证历史消息正确保存
    - [x] 验证 metadata 结构正确

- [x] **Task 1.3**: 发送转人工成功系统消息
  - 文件: `src/app/api/conversations/[id]/transfer/route.ts`
  - 功能:
    - [x] 创建 'system' 类型消息
    - [x] 内容: "您已成功转接至人工客服，客服人员会尽快回复您。"
    - [x] 如果有 transfer_reason，包含在 metadata 中
    - [x] 保存到 `messages.json`
  - 测试:
    - [x] 验证系统消息正确创建
    - [x] 验证消息顺序正确（transfer_history 在前，system 在后）

- [x] **Task 1.4**: SSE 广播转人工事件
  - 文件: `src/app/api/sse/conversations/route.ts`
  - 功能:
    - [x] 添加 `conversation_transferred` 事件类型
    - [x] 向 customer 广播转人工成功
    - [x] 向所有在线 staff 广播新对话通知
    - [x] 包含客户信息、转人工原因等数据
  - 测试:
    - [x] 验证 customer 收到事件
    - [x] 验证所有 staff 收到通知
    - [x] 验证事件数据结构正确

### 前端 Hook 扩展

- [x] **Task 1.5**: 扩展 useConversation Hook
  - 文件: `src/lib/hooks/use-conversation.ts`
  - 功能:
    - [x] 添加 `transferToHuman` 方法
    - [x] 方法接收: conversationId, aiHistory, reason?
    - [x] 调用转人工 API
    - [x] 更新本地 conversation 状态
    - [x] 添加系统消息到消息列表
    - [x] 处理 SSE 事件 `conversation_transferred`
  - 测试:
    - [x] Hook 测试：转人工方法调用正确
    - [x] 状态更新测试：conversation 状态正确变更
    - [x] SSE 处理测试：正确处理转人工事件

### 数据模型更新

- [x] **Task 1.6**: 更新 Conversation 接口定义
  - 文件: `src/lib/stores/conversation-store.ts`, `src/types/conversation.types.ts`
  - 功能:
    - [x] 确保 Conversation 接口包含 `mode: 'ai' | 'human'`
    - [x] 添加 `transferred_at?: string`
    - [x] 添加 `transfer_reason?: string`
    - [x] 添加 `staff_id?: string`
    - [x] 添加 `staff_name?: string`
  - 测试:
    - [x] TypeScript 类型检查通过
    - [x] 现有代码兼容性验证

- [x] **Task 1.7**: 更新 Message 接口定义
  - 文件: `src/types/conversation.types.ts`
  - 功能:
    - [x] 确保 sender_role 包含 'system' 选项
    - [x] 确保 message_type 包含 'system' 和 'transfer_history'
    - [x] 添加 metadata 字段类型定义
  - 测试:
    - [x] TypeScript 类型检查通过

### 初步测试

- [x] **Task 1.8**: 手动测试转人工基本流程
  - [x] Customer 创建 AI 对话
  - [x] Customer 与 AI 交互几轮
  - [x] Customer 点击转人工（暂时使用临时按钮触发 API）
  - [x] 验证 conversation mode 更新为 'human'
  - [x] 验证 transfer_history 消息保存
  - [x] 验证系统消息发送
  - [x] 验证 SSE 事件广播

---

## 阶段 2: 界面优化 (1-2 天)

### Customer 端对话界面

- [x] **Task 2.1**: 实现模式切换逻辑
  - 文件: `src/app/(customer)/conversations/[id]/page.tsx`
  - 功能:
    - [x] 基于 conversation.mode 切换 UI 显示
    - [x] AI 模式：显示 AI 消息历史（state）
    - [x] Human 模式：显示 conversation 消息列表（从 API）
    - [x] 模式切换时平滑过渡
  - 测试:
    - [x] 模式切换流畅无闪烁
    - [x] 消息数据正确加载

- [x] **Task 2.2**: 隐藏 AI 对话历史（Customer 视图）
  - 文件: `src/app/(customer)/conversations/[id]/page.tsx`
  - 功能:
    - [x] 转人工后清空 `aiMessages` state
    - [x] 从消息列表中过滤掉 `transfer_history` 消息
    - [x] 确保 customer 看不到 AI 历史
  - 测试:
    - [x] 验证 AI 历史不显示
    - [x] 验证系统消息正常显示

- [x] **Task 2.3**: 创建 ConversationHeader 组件
  - 文件: `src/components/conversation/conversation-header.tsx`
  - 功能:
    - [x] AI 模式显示：
      - [x] AI 图标和 "AI Assistant" 文字
      - [x] 蓝色 "AI 对话" 标签
      - [x] "转人工" 按钮
    - [x] Human 模式显示：
      - [x] Staff 头像和名称（如果已分配）
      - [x] 绿色 "人工客服" 标签
      - [x] 隐藏"转人工"按钮
      - [x] 显示"等待回复..."状态（可选）
  - 测试:
    - [x] UI 正确渲染
    - [x] 模式切换正确显示
    - [x] 响应式布局正常

- [x] **Task 2.4**: 实现转人工确认对话框
  - 文件: `src/components/conversation/transfer-dialog.tsx`
  - 功能:
    - [x] 点击"转人工"按钮弹出对话框
    - [x] 对话框包含：
      - [x] 确认文字
      - [x] 可选的原因输入框（textarea，最多 200 字）
      - [x] 取消按钮
      - [x] 确认按钮（调用 transferToHuman）
    - [x] 显示加载状态
    - [x] 成功后显示 toast
  - 测试:
    - [x] 对话框正确弹出和关闭
    - [x] 原因输入正确传递
    - [x] 加载状态正确显示

- [x] **Task 2.5**: 固定输入框到页面底部
  - 文件: `src/app/(customer)/conversations/[id]/page.tsx`
  - 功能:
    - [x] 使用 flexbox 布局
    - [x] Header 固定顶部 (`position: sticky`)
    - [x] MessageList 中间可滚动 (`flex: 1, overflow-y: auto`)
    - [x] MessageInput 固定底部 (`position: sticky`)
    - [x] 确保移动端兼容（使用 `100dvh`）
  - CSS:
    ```css
    .conversation-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    ```
  - 测试:
    - [x] 桌面端输入框固定底部
    - [x] 移动端输入框固定底部
    - [x] 滚动消息列表时输入框不动

- [x] **Task 2.6**: 实现消息自动滚动
  - 文件: `src/components/conversation/message-list.tsx`
  - 功能:
    - [x] 新消息到达时检查滚动位置
    - [x] 如果在底部（±50px），自动滚动到底部
    - [x] 如果不在底部，显示"有新消息 ↓"提示
    - [x] 点击提示滚动到底部
    - [x] 使用 `scroll-behavior: smooth`
  - 测试:
    - [x] 新消息自动滚动
    - [x] 查看历史消息时不自动滚动
    - [x] 提示按钮正常工作

- [x] **Task 2.7**: 实现系统消息样式
  - 文件: `src/components/conversation/system-message.tsx`
  - 功能:
    - [x] 居中显示
    - [x] 灰色背景，深灰色文字
    - [x] 圆角样式
    - [x] 转人工成功消息使用绿色背景
  - 测试:
    - [x] 样式正确渲染
    - [x] 响应式适配

### Staff 端界面

- [x] **Task 2.8**: 更新 Staff 对话列表
  - 文件: `src/app/staff/conversations/page.tsx`
  - 功能:
    - [x] 显示对话模式标签（AI/Human）
    - [x] Human 模式的对话优先显示
    - [x] 显示最后消息时间
    - [x] 显示未读消息数（如果有）
    - [x] 点击进入对话详情页
  - 测试:
    - [x] 列表正确渲染
    - [x] 筛选和排序正常

- [x] **Task 2.9**: 创建 Staff 对话详情页
  - 文件: `src/app/staff/conversations/[id]/page.tsx`
  - 功能:
    - [x] 显示完整对话历史（包括 AI 历史）
    - [x] 使用 TransferHistoryMessage 组件显示 AI 历史
    - [x] 显示客户信息
    - [x] 显示转人工原因（如果有）
    - [x] 提供回复输入框
    - [x] 提供关闭对话按钮
  - 测试:
    - [x] 页面正确渲染
    - [x] AI 历史可折叠展开
    - [x] 消息发送正常

- [x] **Task 2.10**: 实现 TransferHistoryMessage 组件
  - 文件: `src/components/conversation/transfer-history-message.tsx`
  - 功能:
    - [x] 显示"AI 对话历史"标题
    - [x] 显示消息条数
    - [x] 可折叠/展开
    - [x] 展开后显示完整 AI 对话
    - [x] 特殊样式区分（灰色背景，边框）
  - 测试:
    - [x] 折叠/展开正常
    - [x] 历史消息正确显示
    - [x] 样式正确应用

---

## 阶段 3: SSE 通知和实时同步 (1 天)

### SSE 事件处理

- [ ] **Task 3.1**: 处理 conversation_transferred 事件（Customer 端）
  - 文件: `src/lib/hooks/use-conversation.ts`
  - 功能:
    - [ ] 监听 `conversation_transferred` 事件
    - [ ] 更新 conversation 状态
    - [ ] 切换界面到 Human 模式
    - [ ] 显示成功 toast
  - 测试:
    - [ ] 事件正确处理
    - [ ] UI 正确更新

- [ ] **Task 3.2**: 处理 conversation_transferred 事件（Staff 端）
  - 文件: `src/app/staff/conversations/page.tsx`
  - 功能:
    - [ ] 监听 `conversation_transferred` 事件
    - [ ] 显示 toast 通知："新的转人工对话，来自 {customer.name}"
    - [ ] 更新对话列表，新对话置顶
    - [ ] 播放提示音（可选）
    - [ ] 高亮显示新对话（3 秒后消失）
  - 测试:
    - [ ] 通知正确显示
    - [ ] 对话列表正确更新
    - [ ] 提示音正常播放

- [ ] **Task 3.3**: 实时消息同步
  - 文件: `src/lib/hooks/use-conversation.ts`
  - 功能:
    - [ ] Human 模式下订阅 SSE 消息
    - [ ] 接收 `new_message` 事件
    - [ ] 更新消息列表
    - [ ] 触发自动滚动
  - 测试:
    - [ ] Customer 和 Staff 消息实时同步
    - [ ] 多个 Staff 同时在线时正常工作

### Toast 通知优化

- [ ] **Task 3.4**: 优化 Toast 通知样式
  - 功能:
    - [ ] 转人工成功：绿色背景，成功图标
    - [ ] 新对话通知：蓝色背景，铃铛图标
    - [ ] 错误通知：红色背景，错误图标
  - 测试:
    - [ ] 样式正确显示
    - [ ] 自动消失（3 秒）

---

## 阶段 4: 高级功能和优化 (2-3 天，可选)

### 对话分配

- [ ] **Task 4.1**: 实现简单的对话分配机制
  - 文件: `src/lib/utils/conversation-assignment.ts`
  - 功能:
    - [ ] 自动分配给第一个在线 staff
    - [ ] 如果没有在线 staff，不分配（队列中等待）
    - [ ] 更新 conversation 的 staff_id 和 staff_name
  - 测试:
    - [ ] 分配逻辑正确
    - [ ] 没有在线 staff 时不分配

- [ ] **Task 4.2**: 允许 Staff 手动接取对话
  - 文件: `src/app/staff/conversations/page.tsx`
  - 功能:
    - [ ] 未分配的对话显示"接取"按钮
    - [ ] 点击接取后分配给当前 staff
    - [ ] 更新对话列表
  - 测试:
    - [ ] 接取功能正常
    - [ ] 已分配的对话不显示按钮

### 输入状态保持

- [ ] **Task 4.3**: 保存未发送的输入内容
  - 文件: `src/app/(customer)/conversations/[id]/page.tsx`
  - 功能:
    - [ ] 使用 localStorage 或 state 保存输入内容
    - [ ] 转人工前保存
    - [ ] 转人工后恢复
    - [ ] 离开页面时保存
    - [ ] 返回页面时恢复
  - 测试:
    - [ ] 输入内容正确保存和恢复
    - [ ] 页面刷新后内容仍在

### 性能优化

- [ ] **Task 4.4**: 实现消息虚拟滚动
  - 文件: `src/components/conversation/message-list.tsx`
  - 功能:
    - [ ] 使用 react-virtual 或 react-window
    - [ ] 只渲染可见区域的消息
    - [ ] 支持 100+ 条消息流畅滚动
  - 测试:
    - [ ] 长对话滚动流畅
    - [ ] 内存占用合理

- [ ] **Task 4.5**: 实现消息分页加载
  - 文件: `src/lib/hooks/use-conversation.ts`
  - 功能:
    - [ ] 默认加载最近 50 条消息
    - [ ] 滚动到顶部时加载更早的消息
    - [ ] 显示"加载更多"指示器
  - 测试:
    - [ ] 分页加载正常
    - [ ] 加载指示器正确显示

### 输入框增强

- [ ] **Task 4.6**: 实现多行输入自动扩展
  - 文件: `src/components/conversation/message-input.tsx`
  - 功能:
    - [ ] 输入内容超过一行时自动扩展高度
    - [ ] 最大高度限制 5 行
    - [ ] 超过 5 行后内部滚动
    - [ ] Enter 发送，Shift+Enter 换行
  - 测试:
    - [ ] 高度自动调整
    - [ ] 快捷键正常工作

### 边界情况处理

- [ ] **Task 4.7**: 防止重复转人工
  - 文件: `src/app/(customer)/conversations/[id]/page.tsx`
  - 功能:
    - [ ] 转人工请求进行中时禁用按钮
    - [ ] 已经是 Human 模式时隐藏按钮
    - [ ] 显示适当的提示信息
  - 测试:
    - [ ] 防重复逻辑正常
    - [ ] 提示信息正确

- [ ] **Task 4.8**: 处理网络错误
  - 所有相关文件
  - 功能:
    - [ ] 转人工失败时显示错误提示
    - [ ] 提供重试按钮
    - [ ] SSE 断开时显示连接状态
    - [ ] 自动重连机制
  - 测试:
    - [ ] 错误处理正常
    - [ ] 重试功能有效

---

## 阶段 5: 测试和文档 (1 天)

### 测试

- [ ] **Task 5.1**: 编写单元测试
  - 文件: `__tests__/`
  - 覆盖:
    - [ ] Conversation 状态转换
    - [ ] 消息过滤逻辑
    - [ ] API 端点
    - [ ] Hooks 方法
  - 目标: 80% 代码覆盖率

- [ ] **Task 5.2**: 编写集成测试
  - 文件: `__tests__/integration/`
  - 场景:
    - [ ] 完整转人工流程
    - [ ] Customer 和 Staff 消息同步
    - [ ] SSE 事件处理
  - 目标: 核心流程 100% 覆盖

- [ ] **Task 5.3**: 编写 E2E 测试（Playwright）
  - 文件: `tests/e2e/`
  - 场景:
    - [ ] Customer 转人工流程
    - [ ] Staff 接收通知和回复
    - [ ] 多用户并发测试
    - [ ] 移动端测试
  - 目标: 关键用户路径 100% 覆盖

- [ ] **Task 5.4**: 手动测试清单
  - [ ] 功能测试（所有功能点）
  - [ ] UI/UX 测试（所有界面）
  - [ ] 兼容性测试（Chrome, Firefox, Safari, 移动端）
  - [ ] 性能测试（长对话，并发用户）
  - [ ] 边界测试（网络中断，重复操作等）

### 文档

- [ ] **Task 5.5**: 更新用户文档
  - 文件: `docs/user-guide/`
  - 内容:
    - [ ] 如何使用转人工功能
    - [ ] 对话模式说明
    - [ ] FAQ

- [ ] **Task 5.6**: 更新开发文档
  - 文件: `docs/developer-guide/`
  - 内容:
    - [ ] API 文档
    - [ ] 架构说明
    - [ ] 组件文档
    - [ ] 测试指南

- [ ] **Task 5.7**: 编写迁移指南
  - 文件: `docs/migration/`
  - 内容:
    - [ ] 从旧系统迁移步骤
    - [ ] 数据迁移脚本
    - [ ] 向后兼容说明
    - [ ] 回滚方案

---

## 验收标准

### 功能完整性
- [ ] 所有 14 个需求点都已实现
- [ ] 核心功能（转人工）100% 工作
- [ ] UI 优化全部完成
- [ ] SSE 实时通知正常

### 代码质量
- [ ] TypeScript 无编译错误
- [ ] ESLint 无 warning
- [ ] 代码审查通过
- [ ] 单元测试覆盖率 ≥ 80%

### 用户体验
- [ ] 页面加载速度 < 2 秒
- [ ] 转人工响应时间 < 1 秒
- [ ] 消息发送延迟 < 500ms
- [ ] UI 流畅无卡顿

### 兼容性
- [ ] Chrome 最新版本正常
- [ ] Firefox 最新版本正常
- [ ] Safari 最新版本正常
- [ ] iOS Safari 正常
- [ ] Android Chrome 正常

### 文档
- [ ] 用户文档完整
- [ ] API 文档完整
- [ ] 代码注释充分
- [ ] README 更新

---

## 风险和缓解措施

### 风险 1: 破坏现有功能
- **影响**: 高
- **概率**: 中
- **缓解**:
  - 充分的单元测试和集成测试
  - 保留旧的 Zammad ticket 创建逻辑作为备选
  - 分阶段发布，先在测试环境验证

### 风险 2: SSE 性能问题
- **影响**: 中
- **概率**: 低
- **缓解**:
  - 限制 SSE 连接数
  - 实现连接池管理
  - 性能测试和监控

### 风险 3: 用户体验不符合预期
- **影响**: 中
- **概率**: 中
- **缓解**:
  - 早期用户测试
  - 收集反馈并快速迭代
  - 提供详细的用户指南

### 风险 4: 数据迁移问题
- **影响**: 高
- **概率**: 低
- **缓解**:
  - 详细的迁移计划
  - 数据备份
  - 回滚方案

---

## 发布计划

### 第 1 次发布（测试环境）
- 包含: 阶段 1 + 阶段 2
- 时间: 开发完成后 1 天
- 目标: 验证核心功能

### 第 2 次发布（预生产环境）
- 包含: 阶段 1 + 阶段 2 + 阶段 3
- 时间: 第 1 次发布后 2 天
- 目标: 验证 SSE 通知和性能

### 第 3 次发布（生产环境）
- 包含: 所有阶段
- 时间: 第 2 次发布后 3 天
- 目标: 正式上线

---

## 需要的资源

### 人员
- 1 名后端开发（API 实现）
- 1 名前端开发（UI 实现）
- 1 名测试工程师（测试）
- 1 名 UI/UX 设计师（界面设计，咨询）

### 工具
- Playwright（E2E 测试）
- Jest（单元测试）
- React Testing Library（组件测试）
- Figma（UI 设计，可选）

### 环境
- 开发环境
- 测试环境
- 预生产环境
- 生产环境

---

## 进度跟踪

使用本文档作为进度跟踪工具：
- [ ] = 未开始
- [x] = 已完成
- 每个任务完成后打勾
- 每个阶段完成后进行阶段性测试和评审

## 备注

1. 阶段 4 的高级功能可以根据优先级和时间灵活调整
2. 建议每个阶段完成后进行 code review
3. 重大变更需要 Product Owner 审批
4. 文档应与代码同步更新
