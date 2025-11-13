# 变更：改进 Conversation 转人工功能

## 原因

当前的 conversation 转人工功能存在多个用户体验和功能性问题：

1. **用户反馈不明确**：转人工成功后没有明确的系统消息告知客户已成功转接
2. **界面混乱**：转人工后 AI 对话历史仍然显示，容易让用户困惑当前在和谁对话
3. **上下文丢失**：Staff 无法看到客户之前与 AI 的完整对话历史，影响服务质量
4. **输入框体验差**：对话框不固定在底部，滚动查看历史消息时输入框会移出视野
5. **架构问题**：当前转人工会创建 Zammad ticket 并重定向，打断了对话的连续性

这些问题严重影响了客服系统的用户体验和工作效率，需要进行系统性改进。

## 变更内容

### 核心功能改进

#### 1. 转人工流程优化
- 转人工时更新 conversation 的 mode 状态（'ai' → 'human'），不再创建新的 Zammad ticket
- 保持在同一个对话界面，避免页面跳转
- 将 AI 对话历史作为系统消息保存到 conversation 消息记录中
- 发送系统消息通知客户转人工成功："您已成功转接至人工客服，请稍候..."

#### 2. 对话界面改进
- **AI 模式下**：
  - 显示 AI 头像和 "AI Assistant" 标识
  - 显示"转人工"按钮
  - 使用轻量级的本地消息存储（aiMessages state）

- **Human 模式下**：
  - 隐藏之前的 AI 对话内容（客户端视图）
  - 显示人工客服头像和名称
  - 隐藏"转人工"按钮（已经是人工模式）
  - 显示"等待客服响应..."状态（如果 staff 尚未回复）

#### 3. Staff 视图增强
- Staff 可以看到完整的对话历史：
  - AI 对话历史（系统消息形式，特殊样式标识）
  - 转人工系统消息
  - 转人工后的人工对话
- Staff 对话列表显示对话模式标签（AI/Human）
- Staff 可以筛选只显示 Human 模式的对话

#### 4. 输入框固定优化
- 对话输入框固定在页面底部
- 不随页面滚动而移动
- 消息列表区域可滚动，输入区域始终可见
- 输入框支持多行输入时自动扩展高度（最大 5 行）

### 新增功能

#### 5. 转人工原因说明
- 转人工前弹出对话框，允许客户说明转人工原因（可选）
- 原因说明作为系统消息的一部分保存
- 帮助 staff 快速了解客户问题

#### 6. SSE 实时通知
- 客户转人工时，通过 SSE 实时通知所有在线 staff
- 通知内容包含：客户信息、对话 ID、转人工时间、原因说明
- Staff 端显示 toast 通知和未读标识

#### 7. 对话分配机制（可选）
- 转人工时可以选择特定 staff（如果知道负责人）
- 或者自动分配给当前在线且负载最少的 staff
- 未分配的对话显示在公共队列中

#### 8. 模式切换指示器
- 在对话顶部显示当前模式：
  - AI 模式：蓝色标签 "AI 对话"
  - Human 模式：绿色标签 "人工客服"
- 转人工时显示加载动画和过渡效果

#### 9. 消息自动滚动
- 新消息到达时自动滚动到底部
- 如果用户正在查看历史消息（滚动位置不在底部），则不自动滚动，只显示"有新消息"提示

#### 10. 输入状态保持
- 转人工前，如果输入框有未发送内容，应该保留
- 转人工完成后，内容仍在输入框中

## 影响

### 受影响的规范
- 需要创建新规范：`conversation-system`
- 如果存在旧的 conversation 相关规范，需要更新

### 受影响的代码

#### 前端组件
- `src/app/(customer)/conversations/[id]/page.tsx` - Customer 对话详情页
- `src/app/staff/conversations/page.tsx` - Staff 对话列表页
- `src/app/staff/conversations/[id]/page.tsx` - Staff 对话详情页（需要创建）
- `src/components/conversation/message-list.tsx` - 消息列表组件
- `src/components/conversation/message-input.tsx` - 输入框组件
- `src/components/conversation/conversation-header.tsx` - 对话头部组件（需要创建）

#### API 路由
- `src/app/api/conversations/[id]/transfer/route.ts` - 转人工 API（需要创建）
- `src/app/api/conversations/[id]/route.ts` - 对话详情 API（需要更新）
- `src/app/api/conversations/[id]/messages/route.ts` - 消息 API（已存在，可能需要调整）
- `src/app/api/sse/conversations/route.ts` - SSE endpoint（已存在，需要添加转人工通知）

#### Hooks 和 Stores
- `src/lib/hooks/use-conversation.ts` - 对话 hook（需要添加转人工方法）
- `src/lib/stores/conversation-store.ts` - 对话状态管理（需要更新）

#### 数据模型
- `data/conversations/conversations.json` - 本地存储结构（需要确保包含 mode 字段）
- `data/conversations/messages.json` - 消息存储（需要支持系统消息类型）

#### 样式文件
- 需要添加固定输入框的 CSS
- 需要添加模式切换的过渡动画

### 破坏性变更
- **中等破坏性**：转人工流程从"创建 ticket 并跳转"改为"更新 conversation mode"
  - 现有的转人工逻辑需要完全重写
  - 需要迁移策略：保持 Zammad ticket 创建作为备选方案（配置开关）

- **UI 破坏性**：对话界面布局调整（输入框固定底部）
  - 现有的滚动行为会改变
  - 需要确保移动端兼容性

### 依赖关系
- 依赖 SSE 基础设施（已完成）
- 依赖本地 conversation 存储（已完成）
- 可选依赖：Staff 用户管理系统（用于对话分配）

## 优先级

**高优先级** - 这些改进直接影响核心用户体验和功能可用性

## 实施建议

### 阶段 1：核心功能（1-2 天）
1. 实现转人工 API endpoint
2. 更新 conversation mode 状态管理
3. 保存 AI 历史记录到消息列表
4. 添加转人工成功系统消息

### 阶段 2：界面优化（1-2 天）
5. 隐藏 AI 对话历史（customer 视图）
6. 固定输入框到页面底部
7. 添加模式切换指示器
8. 实现自动滚动功能

### 阶段 3：Staff 功能（1-2 天）
9. 创建 Staff 对话详情页
10. 显示完整对话历史（包括 AI 部分）
11. 添加 SSE 转人工通知
12. 更新 Staff 对话列表（显示模式标签）

### 阶段 4：高级功能（可选，2-3 天）
13. 转人工原因对话框
14. 对话分配机制
15. 输入状态保持
16. 性能优化和测试

## 测试要点

### 功能测试
- [ ] 转人工流程正常工作（AI → Human）
- [ ] 系统消息正确发送和显示
- [ ] AI 历史记录正确保存
- [ ] Staff 可以看到完整对话历史
- [ ] 输入框固定在底部，滚动不影响
- [ ] 模式切换指示器正确显示

### 集成测试
- [ ] SSE 通知正常工作
- [ ] 多个 Staff 同时在线时通知正确广播
- [ ] Customer 和 Staff 端实时同步
- [ ] 转人工后消息正常收发

### 边界测试
- [ ] 重复点击转人工按钮不会重复转接
- [ ] 已经是 Human 模式的对话不显示转人工按钮
- [ ] 没有 Staff 在线时的处理
- [ ] 网络中断时的错误处理

### 性能测试
- [ ] 长对话历史加载性能
- [ ] 输入框自动扩展不卡顿
- [ ] 消息滚动流畅

### UI/UX 测试
- [ ] 移动端适配
- [ ] 不同屏幕尺寸下输入框正常显示
- [ ] 过渡动画流畅
- [ ] 颜色对比度符合可访问性标准

## 相关文档
- [CONVERSATION-SSE-REFACTOR.md](../../../CONVERSATION-SSE-REFACTOR.md) - SSE 重构文档
- [TEST-RESULTS.md](../../../TEST-RESULTS.md) - 测试结果文档

## 备注

1. **向后兼容**：建议保留创建 Zammad ticket 的选项作为配置开关，以便需要时可以回退
2. **数据迁移**：如果已有生产数据，需要确保现有 AI 对话能够正常转为 human 模式
3. **监控**：建议添加转人工成功率、响应时间等监控指标
4. **文档**：需要更新用户手册，说明新的转人工流程
