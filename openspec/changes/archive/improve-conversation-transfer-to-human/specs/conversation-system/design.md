# Conversation System 规范（完整版）

## 概述

Conversation System 是一个支持 AI 和人工客服无缝切换的对话管理系统。系统**完全独立运行**，不依赖 Zammad，基于 SSE (Server-Sent Events) 实现实时通信，使用本地文件存储管理对话数据。

**设计原则**：
- 简化设计，适合小规模客户场景（<100 并发用户）
- 清晰的视觉区分（左右布局）
- 保留完整对话历史（AI + 人工）
- 实时通信，响应快速

---

## 核心概念

### Conversation（对话）

一个 Conversation 代表客户与客服系统之间的一次完整对话会话。

**属性定义**：

```typescript
interface Conversation {
  id: string                    // 对话 ID，格式：conv_{timestamp}_{random}
  customer_id: string           // 客户 ID
  customer_email: string        // 客户邮箱
  customer_name?: string        // 客户名称
  mode: 'ai' | 'human'         // 对话模式：AI 或人工
  status: 'active' | 'closed'  // 对话状态：活跃或已关闭
  staff_id?: string            // 分配的客服 ID（仅 human 模式）
  staff_name?: string          // 客服名称（仅 human 模式）
  staff_avatar?: string        // 客服头像 URL（仅 human 模式）
  staff_status?: 'online' | 'busy' | 'offline'  // 客服在线状态
  transferred_at?: string      // 转人工时间（ISO 8601 格式）
  transfer_reason?: string     // 转人工原因
  transfer_category?: string   // 转人工类别（技术/账单/订单/其他）
  summary?: string             // 对话总结（AI 生成或 Staff 填写）
  created_at: string           // 创建时间（ISO 8601）
  updated_at: string           // 更新时间（ISO 8601）
  last_message_at: string      // 最后消息时间（ISO 8601）
}
```

**状态机**：

```
[创建] → mode: 'ai', status: 'active'
   ↓
[转人工] → mode: 'human', status: 'active', transferred_at: <timestamp>
   ↓
[关闭] → status: 'closed'
```

**业务规则**：
- 一个对话只能转人工一次（mode 从 'ai' 变为 'human' 不可逆）
- 转人工后必须记录 `transferred_at` 时间戳
- 关闭的对话不能重新打开（需要创建新对话）
- `last_message_at` 在每次有新消息时更新
- ❌ **不再创建或关联 Zammad ticket**

---

### Message（消息）

消息是对话中的基本通信单元。

**属性定义**：

```typescript
interface Message {
  id: string                                    // 消息 ID，格式：msg_{timestamp}_{random}
  conversation_id: string                       // 所属对话 ID
  sender_role: 'customer' | 'ai' | 'staff' | 'system'  // 发送者角色
  sender_id: string                            // 发送者 ID
  sender_name?: string                         // 发送者名称（显示用）
  sender_avatar?: string                       // 发送者头像 URL
  content: string                              // 消息内容（文本或文件信息）
  message_type: 'text' | 'image' | 'file' | 'system' | 'transfer_history' | 'internal_note'  // 消息类型
  metadata?: {
    // 转人工相关
    transfer_reason?: string                   // 转人工原因
    transfer_category?: string                 // 转人工类别
    ai_history?: Array<{                      // AI 对话历史（仅 transfer_history）
      role: 'user' | 'assistant'
      content: string
      timestamp: string
    }>

    // 文件相关
    file_name?: string                        // 文件名
    file_size?: number                        // 文件大小（bytes）
    file_type?: string                        // MIME 类型
    file_url?: string                         // 文件访问 URL

    // 图片相关
    image_url?: string                        // 图片 URL
    image_width?: number                      // 图片宽度
    image_height?: number                     // 图片高度
    thumbnail_url?: string                    // 缩略图 URL

    // 内部备注相关
    is_internal?: boolean                     // 是否为内部备注（customer 不可见）

    // 其他
    summary?: string                          // 对话总结（system 消息）
    [key: string]: any                        // 其他元数据
  }
  created_at: string                           // 创建时间（ISO 8601）
  updated_at?: string                          // 更新时间（ISO 8601）
}
```

**消息类型说明**：

1. **text**：普通文本消息
   - 发送者：customer、ai、staff
   - 用于日常对话交流

2. **image**：图片消息
   - 发送者：customer、staff
   - metadata 包含图片信息和 URL
   - 支持预览和下载

3. **file**：文件消息
   - 发送者：customer、staff
   - metadata 包含文件名、大小、类型、URL
   - 支持 PDF、Word、Excel 等常见文档格式
   - 文件大小限制：10MB

4. **system**：系统消息
   - sender_role 固定为 'system'
   - 用于通知重要事件（转人工成功、对话关闭等）
   - 居中显示，灰色背景

5. **transfer_history**：转人工历史消息
   - sender_role 固定为 'system'
   - 包含完整的 AI 对话历史
   - 仅 staff 可见（customer 看不到）
   - 可折叠/展开显示

6. **internal_note**：内部备注
   - sender_role 为 'staff'
   - metadata.is_internal = true
   - 仅 staff 和 admin 可见
   - 用于记录客户背景、问题要点等

---

### Conversation Mode（对话模式）

#### AI Mode（AI 模式）

- **触发条件**：客户创建新对话时的默认模式
- **参与者**：Customer ↔ AI Assistant
- **消息存储**：
  - 前端：存储在组件 state 中（`aiMessages`）
  - 后端：调用 `/api/ai/chat` 获取回复，不持久化
  - 转人工时才保存到 `messages.json`
- **UI 特征**：
  - 头部显示 "🤖 AI Assistant" 和蓝色 "AI 对话" 标签
  - 显示"转人工"按钮
  - AI 消息在左侧，Customer 消息在右侧
- **限制**：
  - AI 消息不通过 SSE 广播
  - Staff 无法看到 AI 模式的对话（直到转人工）

#### Human Mode（人工模式）

- **触发条件**：客户点击"转人工"按钮
- **参与者**：Customer ↔ Human Staff
- **消息存储**：
  - 所有消息持久化到 `messages.json`
  - 通过 SSE 实时同步
- **UI 特征**：
  - **Customer 端**：
    - 头部显示 "👤 人工客服 - XXX" 和绿色标签
    - 显示 Staff 在线状态（🟢在线 / 🟡忙碌 / ⚫离线）
    - 隐藏"转人工"按钮
    - **保留并淡化显示 AI 对话历史**（灰色、小字体）
    - 转人工系统消息作为分界线
    - Staff 消息在左侧，Customer 消息在右侧
  - **Staff 端**：
    - 显示完整对话历史（AI 历史可折叠）
    - 显示客户信息
    - 显示转人工原因和类别
    - 可以添加内部备注
    - 可以发送文本、图片、文件
    - 可以生成对话总结
- **SSE 事件**：
  - `new_message`：新消息通知
  - `conversation_transferred`：转人工通知（通知所有 staff）
  - `conversation_updated`：对话状态更新
  - `staff_typing`：Staff 正在输入
  - `customer_typing`：Customer 正在输入

---

## API 设计

### 1. 转人工 API

**Endpoint**: `POST /api/conversations/:id/transfer`

**请求体**：
```typescript
{
  reason?: string      // 转人工原因（可选，最多 200 字符）
  category?: string    // 转人工类别：'technical' | 'billing' | 'order' | 'account' | 'other'
  ai_history: Array<{  // AI 对话历史（必须）
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
}
```

**处理流程**：

1. **验证**：
   - 检查用户权限（必须是对话的 customer）
   - 检查对话存在且 mode 为 'ai'
   - 检查对话状态为 'active'
   - 验证 ai_history 不为空

2. **保存 AI 历史**：
   - 创建 `transfer_history` 类型的系统消息
   - 消息包含完整的 AI 对话历史（metadata.ai_history）
   - sender_role 为 'system'

3. **更新对话状态**：
   ```typescript
   {
     mode: 'human',
     transferred_at: new Date().toISOString(),
     transfer_reason: reason,
     transfer_category: category,
     updated_at: new Date().toISOString(),
   }
   ```

4. **发送系统消息**：
   ```typescript
   {
     sender_role: 'system',
     content: '✅ 您已成功转接至人工客服，客服人员会尽快回复您。',
     message_type: 'system',
     metadata: {
       transfer_reason: reason,
       transfer_category: category
     }
   }
   ```

5. **简单分配逻辑**（可选）：
   - 查找第一个在线的 staff
   - 如果有在线 staff，分配给他
   - 否则不分配，放入待处理队列

6. **SSE 广播**：
   - 向 customer 广播转人工成功
   - 向所有在线 staff 广播 `conversation_transferred` 事件

**响应**：
```typescript
{
  success: true,
  data: {
    conversation: Conversation,     // 更新后的对话
    systemMessage: Message,         // 系统消息
    assignedStaff?: {               // 分配的客服（如果有）
      id: string,
      name: string,
      avatar?: string
    }
  }
}
```

**错误处理**：
- 400: 对话已经是 human 模式 / ai_history 为空
- 403: 无权限转人工
- 404: 对话不存在
- 500: 服务器错误

---

### 2. 发送消息 API（扩展）

**Endpoint**: `POST /api/conversations/:id/messages`

**请求体**（支持多种类型）：

```typescript
// 文本消息
{
  content: string,
  message_type: 'text'
}

// 图片消息
{
  content: string,              // 图片描述（可选）
  message_type: 'image',
  metadata: {
    image_url: string,          // 上传后的图片 URL
    image_width?: number,
    image_height?: number,
    thumbnail_url?: string
  }
}

// 文件消息
{
  content: string,              // 文件描述（可选）
  message_type: 'file',
  metadata: {
    file_name: string,
    file_size: number,
    file_type: string,
    file_url: string            // 上传后的文件 URL
  }
}

// 内部备注（仅 staff）
{
  content: string,
  message_type: 'internal_note',
  metadata: {
    is_internal: true
  }
}
```

---

### 3. 文件上传 API

**Endpoint**: `POST /api/conversations/:id/upload`

**请求体**: FormData
- `file`: 文件（最大 10MB）
- `type`: 'image' | 'file'

**响应**：
```typescript
{
  success: true,
  data: {
    url: string,              // 文件访问 URL
    file_name: string,
    file_size: number,
    file_type: string,
    thumbnail_url?: string    // 图片缩略图 URL
  }
}
```

**限制**：
- 图片格式：jpg, png, gif, webp
- 文件格式：pdf, doc, docx, xls, xlsx, txt, zip
- 最大大小：10MB
- 存储位置：`uploads/conversations/{conversation_id}/`

---

### 4. 生成对话总结 API

**Endpoint**: `POST /api/conversations/:id/summary`

**请求体**：
```typescript
{
  manual_summary?: string  // 手动填写的总结（优先）
}
```

**处理流程**：
1. 如果提供了 manual_summary，直接使用
2. 否则，调用 AI API 生成总结：
   - 输入：所有对话消息（AI 历史 + 人工对话）
   - 输出：简洁的对话摘要（1-3 句话）

**响应**：
```typescript
{
  success: true,
  data: {
    summary: string,
    generated_by: 'ai' | 'manual'
  }
}
```

---

### 5. Staff 接取对话 API

**Endpoint**: `POST /api/conversations/:id/claim`

**权限**: 仅 staff 和 admin

**处理流程**：
1. 检查对话是否已分配
2. 如果未分配，分配给当前 staff
3. 更新 conversation 的 staff_id 和 staff_name

**响应**：
```typescript
{
  success: true,
  data: {
    conversation: Conversation
  }
}
```

---

### 6. 获取消息列表 API（更新）

**Endpoint**: `GET /api/conversations/:id/messages`

**查询参数**：
- `role`: 'customer' | 'staff' | 'admin' (可选)

**过滤规则**：
```typescript
// Customer: 隐藏 transfer_history 和 internal_note
if (role === 'customer') {
  messages = messages.filter(msg =>
    msg.message_type !== 'transfer_history' &&
    msg.message_type !== 'internal_note'
  )
}

// Staff/Admin: 显示所有消息
if (role === 'staff' || role === 'admin') {
  // 不过滤
}
```

---

### 7. SSE 事件定义（扩展）

#### conversation_transferred 事件

**触发时机**：客户转人工成功时

**事件数据**：
```typescript
{
  type: 'conversation_transferred',
  conversationId: string,
  data: {
    conversation: Conversation,
    customer: {
      id: string,
      email: string,
      name: string
    },
    transferReason?: string,
    transferCategory?: string,
    aiMessageCount: number,      // AI 对话轮次
    timestamp: string
  }
}
```

**接收者**：所有在线的 staff 用户

**前端处理**（Staff 端）：
- 显示 toast 通知："新的转人工对话，来自 {customer.name}"
- 更新对话列表，将新转人工的对话置顶
- 播放提示音（可选）
- 高亮显示 3 秒

---

#### new_message 事件

**触发时机**：收到新消息时

**事件数据**：
```typescript
{
  type: 'new_message',
  conversationId: string,
  data: {
    message: Message,
    conversation: Conversation
  }
}
```

**接收者**：对话的双方（customer 和 assigned staff）

---

#### conversation_summary 事件

**触发时机**：生成对话总结时

**事件数据**：
```typescript
{
  type: 'conversation_summary',
  conversationId: string,
  data: {
    summary: string,
    generated_by: 'ai' | 'manual'
  }
}
```

---

## UI 设计规范

### 1. 消息布局（左右分明）

**核心原则**：Staff/AI 在左，Customer 在右

```
┌─────────────────────────────────────────┐
│ [Header] 🤖 AI Assistant / 👤 李明      │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐                        │
│  │ [AI Avatar] │                        │
│  │ 您好！我是  │                        │
│  │ AI 助手     │                        │
│  └─────────────┘                        │
│              AI Assistant  10:30        │
│                                         │
│                        ┌──────────────┐ │
│                        │ [Customer]   │ │
│                        │ 我有个问题... │ │
│                        └──────────────┘ │
│                   张三  10:31           │
│                                         │
│  ──────── ✅ 已转接至人工客服 ──────    │
│                                         │
│  ┌─────────────┐                        │
│  │ [Staff]     │                        │
│  │ 好的，我来  │                        │
│  │ 帮您处理    │                        │
│  └─────────────┘                        │
│              李明  10:35  🟢            │
│                                         │
└─────────────────────────────────────────┘
```

**实现细节**：

**Staff/AI 消息（左侧）**：
```css
.message-staff, .message-ai {
  display: flex;
  justify-content: flex-start;  /* 左对齐 */
  margin-bottom: 1rem;
}

.message-bubble-left {
  background: #f3f4f6;          /* 浅灰背景 */
  color: #1f2937;
  border-radius: 0.75rem;
  border-top-left-radius: 0.25rem;  /* 左上角小圆角 */
  padding: 0.75rem 1rem;
  max-width: 70%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
```

**Customer 消息（右侧）**：
```css
.message-customer {
  display: flex;
  justify-content: flex-end;    /* 右对齐 */
  margin-bottom: 1rem;
}

.message-bubble-right {
  background: #3b82f6;          /* 蓝色背景 */
  color: white;
  border-radius: 0.75rem;
  border-top-right-radius: 0.25rem;  /* 右上角小圆角 */
  padding: 0.75rem 1rem;
  max-width: 70%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
```

**系统消息（居中）**：
```css
.message-system {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
}

.message-system-content {
  background: #f9fafb;
  color: #6b7280;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  max-width: 80%;
  text-align: center;
  border: 1px solid #e5e7eb;
}

.message-system.transfer-success {
  background: #dcfce7;  /* 绿色背景 */
  color: #166534;
  border-color: #bbf7d0;
}
```

---

### 2. ConversationHeader 组件

**AI 模式**：
```
┌─────────────────────────────────────────┐
│ 🤖 [AI Icon]  AI Assistant              │
│              [AI 对话] [转人工]         │
└─────────────────────────────────────────┘
```

**Human 模式（Customer 端）**：
```
┌─────────────────────────────────────────┐
│ [Avatar] 李明（人工客服）   🟢在线      │
│           [人工客服]                    │
└─────────────────────────────────────────┘
```

**Human 模式（Staff 端）**：
```
┌─────────────────────────────────────────┐
│ [Avatar] 张三（客户）                   │
│          customer@test.com              │
│          [人工对话] [生成总结] [关闭]   │
└─────────────────────────────────────────┘
```

**组件代码骨架**：

```typescript
interface ConversationHeaderProps {
  conversation: Conversation
  userRole: 'customer' | 'staff' | 'admin'
  onTransfer?: () => void
  onGenerateSummary?: () => void
  onClose?: () => void
}

export function ConversationHeader({
  conversation,
  userRole,
  onTransfer,
  onGenerateSummary,
  onClose
}: ConversationHeaderProps) {
  const isAiMode = conversation.mode === 'ai'
  const isCustomer = userRole === 'customer'

  return (
    <div className="border-b bg-background p-4 sticky top-0 z-10">
      <div className="container max-w-4xl flex items-center gap-4">
        {/* Mode Indicator */}
        <div className="flex items-center gap-2">
          {isAiMode ? (
            <Bot className="h-5 w-5 text-blue-500" />
          ) : (
            <User className="h-5 w-5 text-green-500" />
          )}
        </div>

        {/* Avatar */}
        <Avatar>
          {isAiMode ? (
            <Bot className="h-5 w-5" />
          ) : (
            <AvatarImage src={conversation.staff_avatar} />
          )}
        </Avatar>

        {/* Name and Status */}
        <div className="flex-1">
          <h2 className="font-semibold">
            {isAiMode ? 'AI Assistant' : conversation.staff_name}
          </h2>
          <Badge variant={isAiMode ? 'default' : 'success'}>
            {isAiMode ? '🤖 AI 对话' : '👤 人工客服'}
          </Badge>
          {!isAiMode && conversation.staff_status && (
            <span className="ml-2 text-xs">
              {conversation.staff_status === 'online' && '🟢 在线'}
              {conversation.staff_status === 'busy' && '🟡 忙碌'}
              {conversation.staff_status === 'offline' && '⚫ 离线'}
            </span>
          )}
        </div>

        {/* Actions */}
        {isCustomer && isAiMode && (
          <Button onClick={onTransfer} variant="outline" size="sm">
            <User className="h-4 w-4 mr-2" />
            转人工
          </Button>
        )}

        {!isCustomer && !isAiMode && (
          <>
            <Button onClick={onGenerateSummary} variant="ghost" size="sm">
              生成总结
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm">
              关闭对话
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

---

### 3. TransferDialog 组件

**设计**：
```
┌─────────────────────────────────────┐
│  转接至人工客服                      │
├─────────────────────────────────────┤
│                                     │
│  请选择转人工原因：                  │
│  ○ 🔧 技术问题（AI 无法解决）        │
│  ○ 💳 账单/支付问题                  │
│  ○ 📦 订单/物流问题                  │
│  ○ 🔐 账号/安全问题                  │
│  ● 📝 其他                           │
│                                     │
│  【可选】详细说明：                  │
│  ┌─────────────────────────────┐  │
│  │                             │  │
│  │ (多行文本输入框，最多200字)  │  │
│  │                             │  │
│  └─────────────────────────────┘  │
│                                     │
│  [取消]              [确认转接]     │
└─────────────────────────────────────┘
```

**组件代码骨架**：

```typescript
interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (category: string, reason?: string) => void
  isLoading: boolean
}

const TRANSFER_CATEGORIES = [
  { value: 'technical', label: '🔧 技术问题', description: 'AI 无法解决的技术问题' },
  { value: 'billing', label: '💳 账单/支付问题', description: '费用、发票、支付相关' },
  { value: 'order', label: '📦 订单/物流问题', description: '订单状态、配送相关' },
  { value: 'account', label: '🔐 账号/安全问题', description: '账号、密码、安全相关' },
  { value: 'other', label: '📝 其他', description: '其他需要人工处理的问题' },
]

export function TransferDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading
}: TransferDialogProps) {
  const [category, setCategory] = useState('other')
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    onConfirm(category, reason.trim() || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>转接至人工客服</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <RadioGroup value={category} onValueChange={setCategory}>
            {TRANSFER_CATEGORIES.map(cat => (
              <div key={cat.value} className="flex items-start space-x-2">
                <RadioGroupItem value={cat.value} />
                <div>
                  <Label>{cat.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>

          {/* Optional Reason */}
          <div>
            <Label>详细说明（可选）</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请简要说明需要人工帮助的原因..."
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {reason.length}/200
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? '转接中...' : '确认转接'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### 4. AI 历史显示（Customer 端）

**转人工后，Customer 端应保留 AI 历史，但视觉上淡化**：

```
┌─────────────────────────────────────────┐
│ ［之前的 AI 对话］（灰色、小字体、半透明）│
│  🤖 您好！我是 AI 助手...                │
│     我有个问题...                       │
│  🤖 建议您尝试...                       │
│     还是不行...                         │
│                                         │
│ ──────── ✅ 已转接至人工客服 ──────     │
│                                         │
│ ［当前的人工对话］（正常显示）           │
│  👤 好的，我来帮您处理...               │
│     谢谢！                             │
└─────────────────────────────────────────┘
```

**CSS 实现**：

```css
/* AI 历史消息淡化 */
.message-ai-history {
  opacity: 0.6;
  font-size: 0.875rem;
  color: #6b7280;
}

.message-ai-history .message-bubble-left,
.message-ai-history .message-bubble-right {
  background: #f9fafb;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

/* 转人工分界线 */
.transfer-divider {
  display: flex;
  align-items: center;
  margin: 2rem 0;
  text-align: center;
  color: #059669;
  font-weight: 500;
}

.transfer-divider::before,
.transfer-divider::after {
  content: '';
  flex: 1;
  border-bottom: 2px solid #d1fae5;
}

.transfer-divider::before {
  margin-right: 1rem;
}

.transfer-divider::after {
  margin-left: 1rem;
}
```

---

### 5. TransferHistoryMessage 组件（Staff 端）

**可折叠的 AI 历史显示**：

```
┌───────────────────────────────────────────┐
│ 📋 AI 对话历史 (5 条消息) [▼ 展开]       │
├───────────────────────────────────────────┤
│ (展开后)                                  │
│                                           │
│  Customer: 你好，我想咨询一下...          │
│  AI: 您好！我是 AI 助手，很高兴为您服务...│
│  Customer: 这个问题比较复杂...            │
│  AI: 我理解您的问题，建议您...            │
│  Customer: 还是不行，我要转人工           │
│                                           │
│  转人工原因：🔧 技术问题                  │
│  详细说明：AI 无法解决我的问题            │
│  对话时长：8 分钟                         │
└───────────────────────────────────────────┘
```

**组件代码骨架**：

```typescript
interface TransferHistoryMessageProps {
  message: Message  // message_type === 'transfer_history'
  conversation: Conversation
}

export function TransferHistoryMessage({
  message,
  conversation
}: TransferHistoryMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const history = message.metadata?.ai_history || []

  // 计算对话时长
  const duration = calculateDuration(
    history[0]?.timestamp,
    history[history.length - 1]?.timestamp
  )

  // 找到转人工类别标签
  const categoryLabel = TRANSFER_CATEGORIES.find(
    c => c.value === conversation.transfer_category
  )?.label || '📝 其他'

  return (
    <div className="my-4 border border-gray-200 rounded-lg overflow-hidden">
      {/* Header (Always Visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="font-medium">
            📋 AI 对话历史 ({history.length} 条消息)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Content (Expandable) */}
      {isExpanded && (
        <div className="p-4 bg-white space-y-3">
          {/* AI History Messages */}
          {history.map((item, i) => (
            <div
              key={i}
              className={`flex gap-2 text-sm ${
                item.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {item.role === 'assistant' && (
                <Bot className="h-4 w-4 mt-1 text-blue-500" />
              )}
              <div
                className={`rounded px-3 py-2 max-w-[80%] ${
                  item.role === 'user'
                    ? 'bg-blue-100 text-blue-900'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <strong className="text-xs">
                  {item.role === 'user' ? 'Customer' : 'AI'}:
                </strong>
                <p className="mt-1">{item.content}</p>
                <time className="text-xs text-gray-500">
                  {formatTime(item.timestamp)}
                </time>
              </div>
              {item.role === 'user' && (
                <User className="h-4 w-4 mt-1 text-gray-500" />
              )}
            </div>
          ))}

          {/* Divider */}
          <Separator className="my-4" />

          {/* Transfer Info */}
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span>转人工原因：{categoryLabel}</span>
            </div>
            {conversation.transfer_reason && (
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 mt-0.5" />
                <span>详细说明：{conversation.transfer_reason}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>对话时长：{duration}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### 6. 固定输入框布局

**目标**：输入框始终固定在页面底部，不随滚动消失

```
┌─────────────────────────────────────────┐
│ Header (sticky top)                     │
├─────────────────────────────────────────┤
│                                         │
│  Message List                           │
│  (scrollable, flex: 1)                  │
│                                         │
│  [message 1]                            │
│  [message 2]                            │
│  ...                                    │
│                                         │
├─────────────────────────────────────────┤
│ Input Box (sticky bottom)               │
│ [______________________________] [发送] │
└─────────────────────────────────────────┘
```

**布局实现**：

```tsx
export default function ConversationDetailPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header - Sticky Top */}
      <ConversationHeader
        conversation={conversation}
        className="sticky top-0 z-10 border-b bg-background"
      />

      {/* Messages - Scrollable Middle */}
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl py-4">
          <MessageList messages={messages} />
        </div>
      </div>

      {/* Input - Sticky Bottom */}
      <div className="sticky bottom-0 z-10 border-t bg-background">
        <div className="container max-w-4xl">
          <MessageInput
            onSend={handleSend}
            disabled={isClosed}
          />
        </div>
      </div>
    </div>
  )
}
```

**CSS**：

```css
/* 确保容器占满视口高度 */
.conversation-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; /* 移动端动态视口高度 */
}

/* 消息列表可滚动 */
.message-list-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

/* 输入框固定底部 */
.message-input-container {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: white;
  border-top: 1px solid #e5e7eb;
  padding: 1rem;
}
```

---

### 7. 文件/图片消息显示

**图片消息**：

```
┌─────────────────┐
│ [Thumbnail]     │
│                 │
│  IMG_001.jpg    │
│  245 KB         │
│                 │
│  [查看] [下载]  │
└─────────────────┘
```

**文件消息**：

```
┌─────────────────────────┐
│ 📄 [File Icon]          │
│                         │
│  项目文档.pdf           │
│  1.2 MB                 │
│                         │
│  [下载]                 │
└─────────────────────────┘
```

**组件实现**：

```typescript
export function ImageMessage({ message }: { message: Message }) {
  const { image_url, thumbnail_url, file_name } = message.metadata || {}

  return (
    <div className="message-image">
      <img
        src={thumbnail_url || image_url}
        alt={file_name}
        className="rounded-lg max-w-xs cursor-pointer"
        onClick={() => openImageViewer(image_url)}
      />
      <div className="mt-2 text-xs text-gray-500">
        {file_name}
      </div>
    </div>
  )
}

export function FileMessage({ message }: { message: Message }) {
  const { file_name, file_size, file_type, file_url } = message.metadata || {}

  const icon = getFileIcon(file_type)
  const size = formatFileSize(file_size)

  return (
    <div className="message-file border rounded-lg p-4 max-w-xs">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file_name}</p>
          <p className="text-xs text-gray-500">{size}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3"
        onClick={() => downloadFile(file_url, file_name)}
      >
        <Download className="h-4 w-4 mr-2" />
        下载
      </Button>
    </div>
  )
}
```

---

### 8. 内部备注显示（Staff 端）

**样式**：黄色背景，标注"仅内部可见"

```
┌───────────────────────────────────────┐
│ 🔒 内部备注（仅 Staff 可见）          │
│                                       │
│  客户之前提过类似问题，上次通过重置   │
│  密码解决。建议先检查账号状态。       │
│                                       │
│  - 李明  15:30                        │
└───────────────────────────────────────┘
```

```typescript
export function InternalNoteMessage({ message }: { message: Message }) {
  return (
    <div className="my-2 mx-auto max-w-2xl">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="h-4 w-4 text-yellow-700" />
          <span className="text-sm font-medium text-yellow-700">
            内部备注（仅 Staff 可见）
          </span>
        </div>
        <p className="text-sm text-yellow-900">{message.content}</p>
        <div className="mt-2 text-xs text-yellow-600">
          - {message.sender_name} · {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  )
}
```

---

### 9. 对话总结显示

**显示位置**：对话关闭后，显示在对话底部

```
┌─────────────────────────────────────────┐
│ 📝 对话总结                              │
├─────────────────────────────────────────┤
│                                         │
│  客户遇到了登录问题，尝试了多次密码重置 │
│  后仍无法登录。最终通过清除浏览器缓存   │
│  和 cookie 解决。建议客户定期清理缓存。 │
│                                         │
│  生成方式：AI 自动生成                  │
│  生成时间：2025-11-12 16:45            │
└─────────────────────────────────────────┘
```

---

## 数据存储

### conversations.json（更新）

```json
[
  {
    "id": "conv_1762939944625_95uq4blkm",
    "customer_id": "mock-customer-id",
    "customer_email": "customer@test.com",
    "customer_name": "张三",
    "mode": "human",
    "status": "active",
    "staff_id": "staff-001",
    "staff_name": "李明",
    "staff_avatar": "/avatars/liming.jpg",
    "staff_status": "online",
    "transferred_at": "2025-11-12T10:30:00.000Z",
    "transfer_reason": "AI 无法解决技术问题",
    "transfer_category": "technical",
    "summary": "客户遇到登录问题，通过清除缓存解决",
    "created_at": "2025-11-12T10:00:00.000Z",
    "updated_at": "2025-11-12T10:45:00.000Z",
    "last_message_at": "2025-11-12T10:45:00.000Z"
  }
]
```

### messages.json（更新）

```json
[
  {
    "id": "msg_001",
    "conversation_id": "conv_1762939944625_95uq4blkm",
    "sender_role": "system",
    "sender_id": "system",
    "content": "AI 对话历史",
    "message_type": "transfer_history",
    "metadata": {
      "ai_history": [
        {
          "role": "user",
          "content": "你好，我无法登录",
          "timestamp": "2025-11-12T10:05:00.000Z"
        },
        {
          "role": "assistant",
          "content": "您好！请问您尝试过重置密码吗？",
          "timestamp": "2025-11-12T10:05:05.000Z"
        }
      ]
    },
    "created_at": "2025-11-12T10:30:00.000Z"
  },
  {
    "id": "msg_002",
    "conversation_id": "conv_1762939944625_95uq4blkm",
    "sender_role": "system",
    "sender_id": "system",
    "content": "✅ 您已成功转接至人工客服，客服人员会尽快回复您。",
    "message_type": "system",
    "metadata": {
      "transfer_reason": "AI 无法解决技术问题",
      "transfer_category": "technical"
    },
    "created_at": "2025-11-12T10:30:01.000Z"
  },
  {
    "id": "msg_003",
    "conversation_id": "conv_1762939944625_95uq4blkm",
    "sender_role": "customer",
    "sender_id": "mock-customer-id",
    "sender_name": "张三",
    "content": "我还是无法登录",
    "message_type": "text",
    "created_at": "2025-11-12T10:31:00.000Z"
  },
  {
    "id": "msg_004",
    "conversation_id": "conv_1762939944625_95uq4blkm",
    "sender_role": "staff",
    "sender_id": "staff-001",
    "sender_name": "李明",
    "sender_avatar": "/avatars/liming.jpg",
    "content": "客户之前遇到过类似问题，上次是缓存导致的",
    "message_type": "internal_note",
    "metadata": {
      "is_internal": true
    },
    "created_at": "2025-11-12T10:32:00.000Z"
  },
  {
    "id": "msg_005",
    "conversation_id": "conv_1762939944625_95uq4blkm",
    "sender_role": "staff",
    "sender_id": "staff-001",
    "sender_name": "李明",
    "sender_avatar": "/avatars/liming.jpg",
    "content": "好的，我来帮您看一下。请尝试清除浏览器缓存和 Cookie 后重新登录。",
    "message_type": "text",
    "created_at": "2025-11-12T10:33:00.000Z"
  },
  {
    "id": "msg_006",
    "conversation_id": "conv_1762939944625_95uq4blkm",
    "sender_role": "customer",
    "sender_id": "mock-customer-id",
    "sender_name": "张三",
    "content": "",
    "message_type": "image",
    "metadata": {
      "image_url": "/uploads/conversations/conv_xxx/screenshot.png",
      "thumbnail_url": "/uploads/conversations/conv_xxx/screenshot_thumb.png",
      "image_width": 1920,
      "image_height": 1080,
      "file_name": "screenshot.png",
      "file_size": 251234
    },
    "created_at": "2025-11-12T10:35:00.000Z"
  }
]
```

---

## 前端 Hook 设计

### useConversation Hook（扩展）

```typescript
interface UseConversationReturn {
  // 现有方法
  activeConversation: Conversation | null
  messages: Message[]
  isLoadingMessages: boolean
  isSendingMessage: boolean
  isTyping: boolean
  typingUser: string | null
  fetchMessages: (conversationId: string) => Promise<void>
  sendMessage: (
    conversationId: string,
    content: string,
    messageType?: MessageType,
    metadata?: Record<string, unknown>
  ) => Promise<void>
  subscribeToConversation: (conversationId: string) => () => void

  // 新增：转人工
  transferToHuman: (
    conversationId: string,
    aiHistory: AIMessage[],
    category: string,
    reason?: string
  ) => Promise<void>

  // 新增：上传文件
  uploadFile: (
    conversationId: string,
    file: File,
    type: 'image' | 'file'
  ) => Promise<{ url: string; metadata: FileMetadata }>

  // 新增：生成总结
  generateSummary: (
    conversationId: string,
    manualSummary?: string
  ) => Promise<string>

  // 新增：添加内部备注
  addInternalNote: (
    conversationId: string,
    content: string
  ) => Promise<void>

  // 新增：接取对话
  claimConversation: (conversationId: string) => Promise<void>

  // 新增：关闭对话
  closeConversation: (conversationId: string) => Promise<void>

  // 新增：当前对话模式
  conversationMode: 'ai' | 'human' | null

  // 新增：是否可以转人工
  canTransferToHuman: boolean
}
```

---

## 性能优化

### 1. 消息虚拟滚动（可选）

- 使用 `react-virtual` 或 `react-window`
- 只渲染可见区域的消息（±50 条）
- 适用于超长对话（>100 条消息）

### 2. 图片懒加载

- 使用 `Intersection Observer`
- 滚动到可见区域才加载图片
- 显示加载占位符

### 3. 文件上传优化

- 客户端压缩图片（最大 1920px 宽度）
- 生成缩略图（200x200px）
- 显示上传进度条

### 4. SSE 连接管理

- 自动重连（指数退避）
- 心跳检测（每 30 秒）
- 连接状态显示

---

## 安全考虑

### 1. 权限控制

```typescript
// Customer
- 只能看自己的对话
- 只能转人工自己的对话
- 不能看 transfer_history 和 internal_note

// Staff
- 只能看分配给自己的对话（或未分配的）
- 可以添加内部备注
- 可以上传文件
- 可以生成总结

// Admin
- 可以看所有对话
- 可以强制分配/转接对话
- 可以查看统计数据
```

### 2. 文件上传安全

- 文件类型白名单验证
- 文件大小限制（10MB）
- 病毒扫描（可选）
- 文件名消毒（移除特殊字符）
- 存储路径隔离（按 conversation 分目录）

### 3. XSS 防护

- 消息内容自动转义
- 禁止 HTML 标签（除非明确允许）
- URL 自动转为安全链接

### 4. 数据脱敏

- 导出对话时自动脱敏（手机号、邮箱、身份证等）
- 敏感信息打码显示

---

## 测试用例

### 单元测试

```typescript
describe('Conversation Transfer', () => {
  it('should transfer from ai to human mode', async () => {
    const conv = await createConversation('customer@test.com')
    const aiHistory = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]

    const result = await transferToHuman(conv.id, aiHistory, 'technical')

    expect(result.conversation.mode).toBe('human')
    expect(result.conversation.transferred_at).toBeDefined()
  })

  it('should not allow transfer if already in human mode', async () => {
    const conv = { ...mockConversation, mode: 'human' }

    await expect(transferToHuman(conv.id, [],'technical')).rejects.toThrow()
  })
})

describe('Message Filtering', () => {
  it('should filter transfer_history for customer', () => {
    const messages = [
      { message_type: 'text' },
      { message_type: 'transfer_history' },
      { message_type: 'internal_note' },
    ]

    const filtered = filterMessagesForCustomer(messages)

    expect(filtered).toHaveLength(1)
  })
})

describe('File Upload', () => {
  it('should validate file type', () => {
    const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const invalidFile = new File(['content'], 'test.exe', { type: 'application/exe' })

    expect(isValidFileType(validFile)).toBe(true)
    expect(isValidFileType(invalidFile)).toBe(false)
  })

  it('should validate file size', () => {
    const smallFile = new File(['a'.repeat(1024)], 'small.txt')
    const largeFile = new File(['a'.repeat(11 * 1024 * 1024)], 'large.txt')

    expect(isValidFileSize(smallFile, 10 * 1024 * 1024)).toBe(true)
    expect(isValidFileSize(largeFile, 10 * 1024 * 1024)).toBe(false)
  })
})
```

### 集成测试

```typescript
describe('Full Transfer Flow', () => {
  it('should complete transfer with file upload', async () => {
    // 1. Create AI conversation
    const conv = await createConversation('customer@test.com')

    // 2. Chat with AI
    const aiHistory = [
      { role: 'user', content: 'Help me' },
      { role: 'assistant', content: 'Sure!' },
    ]

    // 3. Transfer to human
    await transferToHuman(conv.id, aiHistory, 'technical', 'Need help')

    // 4. Upload screenshot
    const file = new File(['img'], 'screenshot.png', { type: 'image/png' })
    const upload = await uploadFile(conv.id, file, 'image')

    // 5. Send message with image
    await sendMessage(conv.id, 'See screenshot', 'image', {
      image_url: upload.url
    })

    // 6. Verify messages
    const messages = await getMessages(conv.id)
    expect(messages.some(m => m.message_type === 'image')).toBe(true)
  })
})
```

### E2E 测试

```typescript
test('customer can transfer and upload file', async ({ page }) => {
  // Login
  await page.goto('/conversations')
  await login(page, 'customer@test.com')

  // Start conversation
  await page.click('text=新建对话')
  await page.fill('input[placeholder*="输入"]', 'Hello AI')
  await page.click('button:has-text("发送")')

  // Transfer to human
  await page.click('button:has-text("转人工")')
  await page.click('input[value="technical"]')
  await page.fill('textarea', 'Need technical help')
  await page.click('button:has-text("确认转接")')

  // Verify transfer success
  await expect(page.locator('text=成功转接')).toBeVisible()
  await expect(page.locator('text=人工客服')).toBeVisible()

  // Upload file
  await page.setInputFiles('input[type="file"]', 'test-file.pdf')
  await expect(page.locator('text=test-file.pdf')).toBeVisible()
})
```

---

## 实施优先级

### Phase 1 - 核心功能（P0，必须）

- [x] Transfer API endpoint
- [x] 消息左右布局
- [x] ConversationHeader 组件
- [x] TransferDialog 组件（带分类）
- [x] 修复 Customer 页面转人工逻辑
- [x] Staff 对话详情页
- [x] TransferHistoryMessage 组件
- [x] 输入框固定底部布局
- [x] SSE 转人工事件处理

### Phase 2 - 增强功能（P1，应该）

- [x] Staff 在线状态显示
- [x] 对话队列管理（Staff 列表页）
- [x] 快速回复模板
- [x] AI 历史淡化显示（Customer 端）
- [x] 消息时间戳分组
- [x] 自动滚动和"有新消息"提示

### Phase 3 - 文件和备注（P2，选择实现）

- [x] 文件上传 API
- [x] 图片消息显示
- [x] 文件消息显示
- [x] 内部备注功能
- [x] 对话总结生成

### Phase 4 - 优化（未来）

- [ ] 消息虚拟滚动
- [ ] 图片懒加载
- [ ] 离线消息队列
- [ ] 语音输入
- [ ] 多语言翻译

---

## 配置和环境变量

```env
# 文件上传
UPLOAD_MAX_SIZE=10485760          # 10MB in bytes
UPLOAD_DIR=./uploads/conversations
ALLOWED_IMAGE_TYPES=jpg,jpeg,png,gif,webp
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,txt,zip

# AI 总结
AI_SUMMARY_ENABLED=true
AI_SUMMARY_MAX_LENGTH=200

# SSE
SSE_HEARTBEAT_INTERVAL=30000      # 30 seconds
SSE_RECONNECT_DELAY=5000          # 5 seconds

# Staff 分配
AUTO_ASSIGN_STAFF=true            # 自动分配第一个在线 staff
```

---

## 后续扩展方向

1. **移动端 App**
   - React Native 或 Flutter
   - 推送通知
   - 语音/视频通话

2. **高级分析**
   - 转人工率统计
   - AI 无法解决的问题分析
   - Staff 绩效报表
   - 客户满意度调查

3. **智能路由**
   - 根据问题类型自动分配专家
   - 负载均衡
   - 优先级队列（VIP 客户）

4. **协作功能**
   - Staff 之间转接对话
   - 多个 Staff 协同处理
   - 团队内部讨论区

5. **集成第三方**
   - 邮件通知
   - 短信通知
   - Slack/钉钉集成
   - CRM 系统集成

---

## 总结

本规范定义了一个**完整、简化、实用**的 Conversation System，包括：

✅ **核心功能**：AI ↔ Human 无缝切换
✅ **清晰布局**：左侧 Staff/AI，右侧 Customer
✅ **完整历史**：保留 AI 对话历史（淡化显示）
✅ **文件支持**：图片和文档上传/下载
✅ **内部备注**：Staff 内部沟通工具
✅ **对话总结**：AI 自动生成或手动填写
✅ **实时通信**：SSE 实现即时消息同步
✅ **简化设计**：适合小规模客户场景

**不依赖 Zammad**，纯 Conversation 系统，易于维护和扩展。
