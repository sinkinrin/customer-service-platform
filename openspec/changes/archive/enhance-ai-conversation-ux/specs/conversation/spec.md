## ADDED Requirements

### Requirement: AI 消息 Markdown 渲染

系统 SHALL 将 AI 助手返回的消息内容作为 Markdown 格式渲染，支持以下元素：
- 代码块（带语法高亮）
- 行内代码
- 有序和无序列表
- 链接（在新标签页打开）
- 粗体和斜体文本
- 表格（GFM 扩展）

#### Scenario: AI 返回包含代码块的消息
- **WHEN** AI 返回包含 ```javascript ... ``` 格式的代码块
- **THEN** 系统渲染带有语法高亮的代码块
- **AND** 代码块使用深色主题背景

#### Scenario: AI 返回包含链接的消息
- **WHEN** AI 返回包含 Markdown 链接 [文本](URL)
- **THEN** 系统渲染可点击的超链接
- **AND** 点击链接在新标签页打开
- **AND** 链接包含 rel="noopener noreferrer" 安全属性

#### Scenario: 用户消息保持纯文本
- **WHEN** 用户发送包含 Markdown 语法的消息
- **THEN** 系统按纯文本显示，不进行 Markdown 渲染

### Requirement: AI 加载动画

系统 SHALL 在等待 AI 回复时显示明显的加载动画，让用户知道系统正在处理请求。

#### Scenario: 用户发送消息后显示加载动画
- **WHEN** 用户在 AI 模式下发送消息
- **AND** 系统正在等待 AI 响应
- **THEN** 在消息列表底部显示 "AI 正在思考..." 动画
- **AND** 动画使用脉冲或呼吸效果

#### Scenario: AI 响应后隐藏加载动画
- **WHEN** AI 响应返回成功或失败
- **THEN** 加载动画立即消失
- **AND** 新消息显示在列表中

### Requirement: AI 打字指示器

系统 SHALL 在 AI 模式下复用现有的打字指示器组件，提供一致的用户体验。

#### Scenario: AI 处理时显示打字指示器
- **WHEN** `isAiLoading` 状态为 true
- **THEN** MessageList 组件显示打字指示器
- **AND** 打字用户显示为 "AI 助手"（根据当前语言本地化）

## MODIFIED Requirements

### Requirement: MessageList 组件

MessageList 组件 SHALL 根据消息发送者类型决定渲染方式：
- AI 消息：使用 Markdown 渲染
- 用户消息：使用纯文本渲染
- 系统消息：保持现有渲染方式

#### Scenario: 区分 AI 和用户消息渲染
- **WHEN** 消息的 `sender.role` 为 'staff' 且 `sender_id` 为 'ai'
- **THEN** 使用 Markdown 渲染器显示消息内容
- **WHEN** 消息的 `sender.role` 为 'customer'
- **THEN** 使用纯文本方式显示消息内容
