# AI 对话迁移至 PostgreSQL + 点赞/踩 + Dashboard 看板

**日期**: 2026-02-07
**状态**: 待实施

---

## 1. 目标

1. 将 AI 对话数据从文件系统 (`data/conversations/*.json`) 迁移到 PostgreSQL（Prisma）
2. 新增对 AI 单条回复消息的点赞/点踩功能，点踩时收集 feedback
3. 在 Admin Dashboard 新增 AI 对话统计看板

---

## 2. 数据模型

### 2.1 新增 Prisma 模型

```prisma
model AiConversation {
  id             String   @id @default(cuid())
  customerId     String
  customerEmail  String
  status         String   @default("active")  // active | closed
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lastMessageAt  DateTime @default(now())

  messages       AiMessage[]

  @@index([customerId])
  @@index([customerEmail])
  @@index([status])
  @@map("ai_conversations")
}

model AiMessage {
  id              String   @id @default(cuid())
  conversationId  String
  senderRole      String   // customer | ai | system
  senderId        String
  content         String
  messageType     String   @default("text")
  metadata        String?  // JSON
  createdAt       DateTime @default(now())

  conversation    AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  rating          AiMessageRating?

  @@index([conversationId])
  @@map("ai_messages")
}

model AiMessageRating {
  id        String   @id @default(cuid())
  messageId String   @unique
  userId    String
  rating    String   // positive | negative
  feedback  String?  // 点踩时的反馈文本
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  message   AiMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])
  @@index([userId])
  @@index([rating])
  @@map("ai_message_ratings")
}
```

### 2.2 对话状态管理

- 一个用户同时只有一个 `active` 对话
- 创建新对话时，自动将该用户所有旧的 active 对话标记为 `closed`

---

## 3. 存储层

### 3.1 新建 `src/lib/ai-conversation-service.ts`

替代 `src/lib/local-conversation-storage.ts`，使用 Prisma 操作 PostgreSQL。

**导出函数（保持兼容签名）：**

| 函数 | 说明 |
|------|------|
| `createAIConversation(customerId, customerEmail)` | 关闭旧对话 + 创建新对话 |
| `getConversation(id)` | 按 ID 查对话 |
| `getCustomerConversations(customerEmail)` | 查用户所有对话 |
| `getAllConversations()` | 查所有对话（admin 用） |
| `updateConversation(id, updates)` | 更新对话 |
| `deleteConversation(id)` | 删除对话（级联删消息和评价） |
| `addMessage(conversationId, senderRole, senderId, content, metadata?, messageType?)` | 添加消息 + 更新 lastMessageAt |
| `getConversationMessages(conversationId)` | 获取消息列表（include rating） |
| `getConversationStats(customerEmail)` | 获取用户对话统计 |

**新增函数：**

| 函数 | 说明 |
|------|------|
| `rateMessage(messageId, userId, rating, feedback?)` | 点赞/踩 upsert，rating 为 null 时删除 |
| `getMessageRating(messageId, userId)` | 查询单条消息评价 |
| `getAiConversationDashboardStats()` | Dashboard 统计数据 |

### 3.2 删除旧文件

- 删除 `src/lib/local-conversation-storage.ts`
- 删除 `data/conversations/` 目录（开发数据，不做迁移）

---

## 4. API 路由

### 4.1 现有路由改造

以下路由的 import 从 `local-conversation-storage` 切换到 `ai-conversation-service`：

- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[id]/route.ts`
- `src/app/api/conversations/[id]/messages/route.ts`

### 4.2 新增路由

**`PUT /api/conversations/[id]/messages/[messageId]/rating`**

请求体：
```json
{ "rating": "positive" }
{ "rating": "negative", "feedback": "回答不准确" }
{ "rating": null }
```

响应：
```json
{ "success": true, "data": { "rating": "negative", "feedback": "回答不准确" } }
```

**`GET /api/admin/stats/ai-conversations`**

返回 Dashboard 统计数据：
```json
{
  "success": true,
  "data": {
    "conversations": { "total": 100, "active": 15, "closed": 85 },
    "messages": { "total": 500, "customer": 250, "ai": 250 },
    "ratings": { "positive": 80, "negative": 20, "satisfactionRate": 80 },
    "recentNegative": [
      {
        "messageId": "...",
        "content": "AI 回复内容摘要...",
        "feedback": "回答不准确",
        "createdAt": "..."
      }
    ]
  }
}
```

---

## 5. 前端

### 5.1 消息点赞/踩 UI

**位置**: `src/app/customer/conversations/[id]/page.tsx`

- 每条 AI 回复消息底部加 👍👎 按钮
- 未评价：outline 灰色
- 已点赞：👍 高亮绿色
- 已点踩：👎 高亮红色
- 乐观更新 UI，异步调 API

### 5.2 Feedback 弹窗

**新建组件**: `src/components/ai/feedback-dialog.tsx`

- 触发时机：点踩 / 切换赞→踩
- shadcn/ui Dialog
- 标题 + Textarea + "跳过" + "提交" 按钮
- 跳过 = 提交踩但不填 feedback

### 5.3 Admin Dashboard 看板

**位置**: `src/app/admin/dashboard/page.tsx`

新增卡片区域：
- AI 对话总数（总数 / 活跃 / 已关闭）
- AI 消息总数（用户消息 / AI 回复）
- AI 评价统计（赞数 / 踩数 / 好评率%）
- 最近差评列表（最近 5 条踩 + feedback）

---

## 6. i18n

所有 6 种语言（en, zh-CN, fr, es, ru, pt）需要新增翻译 key：

**对话页面**:
- `aiChat.rate.helpful` / `aiChat.rate.notHelpful`
- `aiChat.feedback.title` / `aiChat.feedback.placeholder`
- `aiChat.feedback.submit` / `aiChat.feedback.skip`

**Admin Dashboard**:
- `admin.dashboard.aiStats.title`
- `admin.dashboard.aiStats.conversations` / `active` / `closed`
- `admin.dashboard.aiStats.messages` / `customerMessages` / `aiReplies`
- `admin.dashboard.aiStats.ratings` / `positive` / `negative` / `satisfactionRate`
- `admin.dashboard.aiStats.recentNegative`

---

## 7. 实施步骤

1. Prisma schema 新增 3 个模型 + 执行 migration
2. 新建 `ai-conversation-service.ts`（Prisma 实现）
3. 改造现有 3 个 API 路由的 import
4. 新建评价 API 路由
5. 新建 Dashboard 统计 API 路由
6. 前端：消息气泡加点赞/踩按钮
7. 前端：新建 feedback 弹窗组件
8. 前端：Dashboard 新增 AI 看板卡片
9. i18n：6 种语言翻译
10. 删除旧的文件存储代码
