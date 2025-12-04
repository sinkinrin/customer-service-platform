# 变更：优化 AI 对话用户体验

## 原因

当前 AI 对话功能存在以下用户体验问题：
1. AI 回复的 Markdown 内容（代码块、列表、链接等）未正确渲染，显示为纯文本
2. 等待 AI 回复时缺少明显的加载动画，用户无法感知系统正在处理
3. AI 模式下缺少打字指示器，与人工模式体验不一致

## 变更内容

### 1. Markdown 渲染支持
- 在 `MessageList` 组件中为 AI 消息添加 Markdown 渲染
- 使用 `react-markdown` 配合 `remark-gfm` 支持 GitHub Flavored Markdown
- 添加 `react-syntax-highlighter` 实现代码块语法高亮
- 保持用户消息为纯文本显示

### 2. AI 加载动画
- 在等待 AI 回复时显示"AI 正在思考"动画
- 使用脉冲点动画，与现有 UI 风格一致
- 加载状态自动滚动到视图底部

### 3. AI 打字指示器
- AI 模式下显示打字指示器，复用现有的 `TypingIndicator` 组件
- 在 `isAiLoading` 状态时显示 "AI 助手正在输入..."

### 4. 消息样式优化
- AI 消息使用不同的视觉样式（渐变背景或特殊标识）
- Markdown 内容的代码块使用深色主题
- 链接可点击并在新标签页打开

## 影响

- 受影响的组件：
  - `src/components/conversation/message-list.tsx`
  - `src/app/customer/conversations/[id]/page.tsx`
- 新增依赖：
  - `react-markdown`
  - `remark-gfm`
  - `react-syntax-highlighter`
- 国际化：需要添加 AI 打字提示的翻译

## 不在范围内

- 流式响应（Streaming）- 需要后端支持，作为后续迭代
- 消息复制功能 - 独立需求
- 消息重新生成功能 - 独立需求
