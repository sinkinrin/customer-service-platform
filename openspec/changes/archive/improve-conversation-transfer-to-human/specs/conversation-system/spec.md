## ADDED Requirements

### Requirement: Conversation 转人工功能
系统 **SHALL** 支持客户将 AI 对话转接至人工客服，并保持对话连续性。

#### Scenario: 客户发起转人工请求
- **WHEN** 客户在 AI 对话中点击"转人工"按钮
- **THEN** 系统应显示转人工确认对话框，包含转人工原因分类选择

#### Scenario: 选择转人工原因并确认
- **WHEN** 客户选择转人工类别（技术/账单/订单/账号/其他）并可选填写详细说明
- **THEN** 系统应保存 AI 对话历史并更新 conversation mode 从 'ai' 到 'human'

#### Scenario: 转人工成功通知
- **WHEN** 转人工操作成功完成
- **THEN** 系统应显示系统消息"✅ 您已成功转接至人工客服，客服人员会尽快回复您"

#### Scenario: 转人工后禁用 AI 对话
- **WHEN** 对话已转为 human 模式
- **THEN** 系统应隐藏"转人工"按钮并禁止客户再次与 AI 对话

#### Scenario: 防止重复转人工
- **WHEN** 客户尝试转人工已经是 human 模式的对话
- **THEN** 系统应拒绝请求并返回错误提示

---

### Requirement: AI 对话历史保存
系统 **MUST** 在转人工时保存完整的 AI 对话历史，供 Staff 查看。

#### Scenario: 保存 AI 历史为系统消息
- **WHEN** 客户转人工成功
- **THEN** 系统应创建 transfer_history 类型的系统消息，包含所有 AI 对话记录

#### Scenario: Staff 查看 AI 对话历史
- **WHEN** Staff 打开转人工的对话
- **THEN** 系统应显示可折叠的 AI 对话历史，包含消息条数、对话时长、转人工原因

#### Scenario: Customer 不可见 AI 历史系统消息
- **WHEN** Customer 查看转人工后的对话消息
- **THEN** 系统应过滤掉 transfer_history 类型的消息，不显示给 Customer

---

### Requirement: 消息左右布局
系统 **SHALL** 使用清晰的左右布局区分 Staff/AI 消息和 Customer 消息。

#### Scenario: AI 消息显示在左侧
- **WHEN** 系统显示 AI 消息
- **THEN** 消息应左对齐，使用浅灰色背景，AI 头像在左侧

#### Scenario: Staff 消息显示在左侧
- **WHEN** 系统显示 Staff 消息
- **THEN** 消息应左对齐，使用浅灰色背景，Staff 头像在左侧

#### Scenario: Customer 消息显示在右侧
- **WHEN** 系统显示 Customer 消息
- **THEN** 消息应右对齐，使用蓝色背景，Customer 头像在右侧

#### Scenario: 系统消息居中显示
- **WHEN** 系统显示系统消息（如转人工通知）
- **THEN** 消息应居中显示，使用特殊样式（灰色或绿色背景）

---

### Requirement: AI 历史淡化显示
系统 **SHALL** 在 Customer 端保留 AI 对话历史，但视觉上淡化处理。

#### Scenario: 转人工后保留 AI 历史
- **WHEN** Customer 查看转人工后的对话
- **THEN** 系统应继续显示之前的 AI 对话消息

#### Scenario: AI 历史视觉淡化
- **WHEN** Customer 查看转人工后的 AI 历史消息
- **THEN** AI 历史消息应使用淡化样式（降低透明度、灰色文字、小字号）

#### Scenario: 转人工分界线
- **WHEN** 显示 AI 历史和人工对话的交界处
- **THEN** 系统应显示明显的分界线和"已转接至人工客服"标识

---

### Requirement: ConversationHeader 组件
系统 **SHALL** 在对话页面顶部显示对话状态和操作按钮。

#### Scenario: AI 模式显示
- **WHEN** 对话处于 AI 模式
- **THEN** Header 应显示 AI 图标、"AI Assistant"文字、蓝色"AI 对话"标签、"转人工"按钮

#### Scenario: Human 模式显示（Customer 端）
- **WHEN** 对话处于 Human 模式且用户是 Customer
- **THEN** Header 应显示 Staff 头像、Staff 名称、绿色"人工客服"标签、Staff 在线状态

#### Scenario: Human 模式显示（Staff 端）
- **WHEN** 对话处于 Human 模式且用户是 Staff
- **THEN** Header 应显示 Customer 头像、Customer 名称和邮箱、"生成总结"按钮、"关闭对话"按钮

---

### Requirement: Staff 对话详情页
系统 **MUST** 提供 Staff 查看和回复转人工对话的页面。

#### Scenario: Staff 查看对话列表
- **WHEN** Staff 访问对话列表页面
- **THEN** 系统应显示所有 human 模式的对话，包含客户名称、最后消息时间、未读标识

#### Scenario: Staff 打开对话详情
- **WHEN** Staff 点击某个对话
- **THEN** 系统应显示完整对话历史（包括 AI 历史）、客户信息、转人工原因

#### Scenario: Staff 回复客户
- **WHEN** Staff 在对话详情页发送消息
- **THEN** 系统应将消息保存并通过 SSE 实时发送给 Customer

#### Scenario: Staff 查看客户信息
- **WHEN** Staff 查看对话详情
- **THEN** 系统应在侧边栏或顶部显示客户邮箱、名称、历史对话数等信息

---

### Requirement: 输入框固定底部布局
系统 **SHALL** 将消息输入框固定在页面底部，不随滚动消失。

#### Scenario: 输入框固定显示
- **WHEN** 用户滚动查看历史消息
- **THEN** 输入框应始终固定在页面底部，可见且可操作

#### Scenario: 消息列表可滚动
- **WHEN** 消息数量超过屏幕高度
- **THEN** 消息列表区域应可滚动，但不影响输入框位置

#### Scenario: 移动端适配
- **WHEN** 用户在移动设备上使用系统
- **THEN** 输入框应使用动态视口高度（100dvh），适配移动端键盘

---

### Requirement: SSE 转人工实时通知
系统 **SHALL** 通过 SSE 实时通知 Staff 有新的转人工对话。

#### Scenario: 广播转人工事件
- **WHEN** Customer 成功转人工
- **THEN** 系统应向所有在线 Staff 广播 conversation_transferred 事件

#### Scenario: Staff 接收转人工通知
- **WHEN** Staff 收到 conversation_transferred 事件
- **THEN** 系统应显示 toast 通知"新的转人工对话，来自 {customer_name}"

#### Scenario: 对话列表自动更新
- **WHEN** Staff 收到转人工通知
- **THEN** 对话列表应自动刷新，将新对话置顶并高亮 3 秒

---

### Requirement: 文件上传功能
系统 **SHALL** 支持在对话中上传和发送图片、文档文件。

#### Scenario: 客户上传图片
- **WHEN** Customer 在对话中点击图片上传按钮并选择图片文件
- **THEN** 系统应上传图片，生成缩略图，并在对话中显示图片消息

#### Scenario: 客户上传文档
- **WHEN** Customer 在对话中点击文件上传按钮并选择文档文件（PDF, Word, Excel等）
- **THEN** 系统应上传文件并在对话中显示文件消息（文件名、大小、下载按钮）

#### Scenario: 文件类型验证
- **WHEN** 用户尝试上传不支持的文件类型（如 .exe）
- **THEN** 系统应拒绝上传并提示支持的文件格式

#### Scenario: 文件大小限制
- **WHEN** 用户尝试上传超过 10MB 的文件
- **THEN** 系统应拒绝上传并提示文件大小超限

#### Scenario: Staff 上传文件回复
- **WHEN** Staff 需要向 Customer 发送文件
- **THEN** Staff 应能上传图片或文档，Customer 可以查看和下载

---

### Requirement: 内部备注功能
系统 **SHALL** 支持 Staff 添加仅内部可见的备注。

#### Scenario: Staff 添加内部备注
- **WHEN** Staff 在对话中切换到"内部备注"模式并发送消息
- **THEN** 系统应创建 internal_note 类型的消息，仅 Staff 和 Admin 可见

#### Scenario: 内部备注特殊样式
- **WHEN** Staff 查看包含内部备注的对话
- **THEN** 内部备注应使用黄色背景，带有"🔒 仅 Staff 可见"标识

#### Scenario: Customer 不可见内部备注
- **WHEN** Customer 查看对话消息
- **THEN** 系统应过滤掉所有 internal_note 类型的消息

#### Scenario: 其他 Staff 可见备注
- **WHEN** 其他 Staff 打开同一对话
- **THEN** 系统应显示所有 Staff 添加的内部备注，包含作者和时间

---

### Requirement: 对话总结功能
系统 **SHALL** 支持生成对话总结，帮助快速了解对话内容。

#### Scenario: Staff 请求 AI 生成总结
- **WHEN** Staff 点击"生成总结"按钮
- **THEN** 系统应调用 AI API，基于完整对话历史生成简洁摘要（1-3 句话）

#### Scenario: Staff 手动填写总结
- **WHEN** Staff 在总结输入框中填写自定义总结
- **THEN** 系统应保存手动填写的总结，优先于 AI 生成的总结

#### Scenario: 显示对话总结
- **WHEN** Staff 或 Admin 查看已关闭的对话
- **THEN** 系统应在对话底部显示总结，包含生成方式（AI/手动）和时间

#### Scenario: 总结长度限制
- **WHEN** 生成或填写对话总结
- **THEN** 总结内容应限制在 200 字符以内

---

### Requirement: Staff 在线状态显示
系统 **SHALL** 显示 Staff 的实时在线状态。

#### Scenario: 显示 Staff 在线状态
- **WHEN** Customer 查看已转人工的对话
- **THEN** 系统应显示分配的 Staff 的在线状态（🟢在线 / 🟡忙碌 / ⚫离线）

#### Scenario: 在线状态实时更新
- **WHEN** Staff 的在线状态发生变化
- **THEN** Customer 端应通过 SSE 实时更新显示的状态

---

### Requirement: 对话队列管理
系统 **SHALL** 为 Staff 提供对话队列管理功能。

#### Scenario: 查看未分配对话队列
- **WHEN** Staff 访问对话列表页面
- **THEN** 系统应显示所有未分配 staff_id 的 human 模式对话

#### Scenario: Staff 主动接取对话
- **WHEN** Staff 点击未分配对话的"接取"按钮
- **THEN** 系统应将对话分配给当前 Staff 并更新对话列表

#### Scenario: 优先显示新转人工对话
- **WHEN** 显示对话列表
- **THEN** 最近转人工的对话应显示在列表顶部

---

### Requirement: 快速回复模板
系统 **SHALL** 提供 Staff 常用回复模板，提高回复效率。

#### Scenario: 选择快速回复模板
- **WHEN** Staff 点击输入框旁的"模板"按钮
- **THEN** 系统应显示预设的回复模板列表（问候语、常见解答、结束语等）

#### Scenario: 插入模板内容
- **WHEN** Staff 选择某个模板
- **THEN** 系统应将模板内容插入到输入框中，Staff 可以编辑后发送

#### Scenario: 模板支持变量
- **WHEN** 模板包含变量（如 {customer_name}）
- **THEN** 系统应自动替换为实际的客户信息

---

### Requirement: 消息时间戳分组
系统 **SHALL** 按时间分组显示消息，提高可读性。

#### Scenario: 显示日期分隔线
- **WHEN** 消息跨越不同日期
- **THEN** 系统应显示日期分隔线（如"─── 今天 ───"、"─── 昨天 ───"）

#### Scenario: 显示消息时间
- **WHEN** 显示每条消息
- **THEN** 系统应在消息下方显示发送时间（如"10:30"）

---

### Requirement: 自动滚动和新消息提示
系统 **SHALL** 智能处理消息滚动行为。

#### Scenario: 新消息自动滚动到底部
- **WHEN** 收到新消息且用户当前位置在消息列表底部（±50px）
- **THEN** 系统应自动平滑滚动到最新消息

#### Scenario: 查看历史时不自动滚动
- **WHEN** 收到新消息但用户正在查看历史消息（滚动位置不在底部）
- **THEN** 系统应保持当前滚动位置并显示"有新消息 ↓"提示按钮

#### Scenario: 点击新消息提示
- **WHEN** 用户点击"有新消息 ↓"按钮
- **THEN** 系统应平滑滚动到最新消息并隐藏提示按钮

---

### Requirement: Staff 接取对话功能
系统 **SHALL** 支持 Staff 主动接取或分配对话。

#### Scenario: Staff 接取未分配对话
- **WHEN** Staff 在对话列表中点击未分配对话的"接取"按钮
- **THEN** 系统应将对话分配给当前 Staff

#### Scenario: 自动分配给在线 Staff
- **WHEN** Customer 转人工且系统启用自动分配
- **THEN** 系统应自动将对话分配给第一个在线的 Staff

#### Scenario: 显示已分配状态
- **WHEN** 对话已分配给某个 Staff
- **THEN** 系统应在对话列表中显示分配的 Staff 名称

---

### Requirement: 关闭对话功能
系统 **SHALL** 支持 Staff 关闭已解决的对话。

#### Scenario: Staff 关闭对话
- **WHEN** Staff 点击"关闭对话"按钮并确认
- **THEN** 系统应更新 conversation status 为 'closed'

#### Scenario: 关闭对话后禁用输入
- **WHEN** 对话状态为 'closed'
- **THEN** 系统应禁用消息输入框并显示"对话已关闭"提示

#### Scenario: 显示对话总结
- **WHEN** 对话关闭后
- **THEN** 系统应自动显示或生成对话总结

---

## MODIFIED Requirements

### Requirement: Conversation 数据模型扩展
Conversation 对象 **MUST** 包含转人工相关的新字段。

#### Scenario: 存储转人工信息
- **WHEN** 对话转人工成功
- **THEN** Conversation 应包含 mode='human', transferred_at, transfer_reason, transfer_category, staff_id, staff_name 等字段

---

### Requirement: Message 数据模型扩展
Message 对象 **MUST** 支持更多消息类型和元数据。

#### Scenario: 支持新的消息类型
- **WHEN** 系统创建或显示消息
- **THEN** 应支持 text, image, file, system, transfer_history, internal_note 六种消息类型

#### Scenario: 存储消息元数据
- **WHEN** 消息包含附加信息（文件、图片、转人工原因等）
- **THEN** 应将附加信息存储在 metadata 字段中

---

### Requirement: 获取消息 API 支持角色过滤
获取消息的 API **MUST** 根据用户角色过滤返回的消息。

#### Scenario: Customer 获取消息
- **WHEN** Customer 请求获取对话消息
- **THEN** 系统应过滤掉 transfer_history 和 internal_note 类型的消息

#### Scenario: Staff 获取消息
- **WHEN** Staff 请求获取对话消息
- **THEN** 系统应返回所有消息，包括 transfer_history 和 internal_note

---

## REMOVED Requirements

### Requirement: 转人工创建 Zammad Ticket
系统不再在转人工时创建 Zammad ticket。

#### Scenario: 转人工不跳转到 Ticket 页面
- **WHEN** Customer 转人工成功
- **THEN** 系统应保持在当前对话页面，不跳转到 Zammad ticket 页面

#### Scenario: Conversation 不关联 Zammad Ticket
- **WHEN** 创建或转人工 conversation
- **THEN** 系统应使用本地存储管理对话，不创建或关联 zammad_ticket_id（可选字段保留用于向后兼容）
