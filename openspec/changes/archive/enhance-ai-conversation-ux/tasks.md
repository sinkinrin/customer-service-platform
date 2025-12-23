# 实施任务清单

## 1. 依赖安装

- [x] 1.1 安装 `react-markdown` 用于 Markdown 渲染
- [x] 1.2 安装 `remark-gfm` 支持 GitHub Flavored Markdown
- [x] 1.3 安装 `react-syntax-highlighter` 和类型定义用于代码高亮

## 2. MessageList 组件改造

- [x] 2.1 创建 `MarkdownMessage` 子组件封装 Markdown 渲染逻辑
- [x] 2.2 在 `renderMessageContent` 中检测 AI 消息并使用 Markdown 渲染
- [x] 2.3 配置代码块语法高亮（使用 oneDark 或类似深色主题）
- [x] 2.4 添加 Markdown 样式（链接颜色、列表缩进、代码块背景等）
- [x] 2.5 确保链接在新标签页打开并添加安全属性

## 3. AI 加载动画

- [x] 3.1 创建 `AIThinkingIndicator` 组件
- [x] 3.2 在 MessageList 中当 `isAiLoading` 时显示加载动画
- [x] 3.3 加载动画显示时自动滚动到底部

## 4. AI 打字指示器

- [x] 4.1 修改对话页面，传递 AI 加载状态到 MessageList 的 `isAiLoading`
- [x] 4.2 当 `isAiLoading` 时显示 AIThinkingIndicator 组件
- [x] 4.3 添加国际化翻译键

## 5. 样式优化

- [x] 5.1 为 AI 消息添加区分样式（渐变背景 AI 图标）
- [x] 5.2 确保暗色模式下代码块正确显示（使用 oneDark 主题）
- [x] 5.3 测试不同长度的 Markdown 内容显示效果 ✅ 已验证

## 6. 国际化

- [x] 6.1 添加 `aiAssistant` 翻译键到所有语言文件
- [x] 6.2 添加 `aiThinking` 翻译键到所有语言文件

## 7. 测试验证

- [x] 7.1 测试代码块渲染（多种语言） ✅ 已验证
- [x] 7.2 测试列表、链接、粗体/斜体渲染 ✅ 已验证
- [x] 7.3 测试加载动画显示和消失时机 ✅ 已验证
- [x] 7.4 测试暗色模式兼容性 ✅ 已验证
- [x] 7.5 测试多语言切换 ✅ 已验证
