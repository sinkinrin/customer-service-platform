# 数据库结构

> 当前本地持久化模型与 Zammad 数据边界说明。

**最后更新**：2026-04-20
**Prisma 版本**：`6.19.0`

---

## 总览

本项目使用 Prisma + PostgreSQL 存储**本地支撑数据**，而不是把数据库当作主工单库。

最重要的边界是：

- **Zammad** 保存 ticket 真相和大量用户 / 组信息
- **Prisma + PostgreSQL** 保存平台本地需要补充维护的数据

Schema 真相来源：`prisma/schema.prisma`
Prisma client：`src/lib/prisma.ts`

---

## 当前数据库提供方

当前 Prisma datasource 是：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

示例：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/customer_service
```

这已经覆盖掉旧文档里把 SQLite 写成“当前数据库”的说法。

---

## 本地数据库存什么

### FAQ 数据

本地 FAQ 完全由 Prisma 支撑：

- `FaqCategory`
- `FaqArticle`
- `FaqArticleTranslation`
- `FaqRating`

### 文件元数据

平台自管文件的元数据存于：

- `UploadedFile`

### 工单支撑数据

围绕 Zammad 工单的本地支撑数据包括：

- `TicketRating`
- `ReplyTemplate`
- `TicketUpdate`
- `Notification`
- `CustomerStaffBinding`

### AI 数据

本地 AI 持久化包括：

- `AiConversation`
- `AiMessage`
- `AiMessageRating`
- `AiQaReview`

### 用户映射

本地用户与 Zammad 用户的映射存于：

- `UserZammadMapping`

---

## 本地数据库不存什么

本地数据库不是以下数据的真相来源：

- ticket
- ticket article / reply
- Zammad 中的 owner / group 当前状态
- 大部分 Zammad 用户与 group 主数据

这些仍然通过 `src/lib/zammad/client.ts` 从外部系统读取或写入。

---

## 当前 Prisma 模型列表

当前 schema 中的模型有：

1. `FaqCategory`
2. `FaqArticle`
3. `FaqArticleTranslation`
4. `FaqRating`
5. `UserZammadMapping`
6. `UploadedFile`
7. `TicketRating`
8. `ReplyTemplate`
9. `TicketUpdate`
10. `Notification`
11. `AiConversation`
12. `AiMessage`
13. `AiMessageRating`
14. `AiQaReview`
15. `CustomerStaffBinding`

---

## 模型分组说明

### FAQ 模型

#### `FaqCategory`

FAQ 分类。

关键字段：

- `name`
- `description`
- `icon`
- `slug`
- `sortOrder`
- `isActive`

#### `FaqArticle`

FAQ 文章主记录。

关键字段：

- `categoryId`
- `slug`
- `views`
- `isActive`

#### `FaqArticleTranslation`

多语言 FAQ 内容。

关键字段：

- `articleId`
- `locale`
- `title`
- `content`
- `keywords`

#### `FaqRating`

FAQ 文章的 helpful / not helpful 反馈。

关键字段：

- `articleId`
- `userId`
- `isHelpful`

---

### 用户映射

#### `UserZammadMapping`

把平台本地用户 ID 映射到 Zammad 用户 ID。

关键字段：

- `userId`
- `zammadUserId`
- `zammadUserEmail`

---

### 文件元数据

#### `UploadedFile`

平台自管文件的元数据。

关键字段：

- `userId`
- `bucketName`
- `filePath`
- `fileName`
- `fileSize`
- `mimeType`
- `referenceType`
- `referenceId`

注意：这不代表所有工单附件都走本地存储；ticket/article 附件仍可能走 Zammad 附件链路。

---

### 工单支撑模型

#### `TicketRating`

客户对 Zammad 工单的评分。

关键字段：

- `ticketId`
- `userId`
- `rating`
- `reason`

#### `ReplyTemplate`

坐席快捷回复模板。

关键字段：

- `name`
- `content`
- `category`
- `region`
- `createdById`
- `isActive`

#### `TicketUpdate`

Webhook 入站后落地的标准化工单更新事件。

关键字段：

- `ticketId`
- `event`
- `data`
- `createdAt`

#### `Notification`

持久化站内通知。

关键字段：

- `userId`
- `type`
- `title`
- `body`
- `data`
- `read`
- `readAt`
- `expiresAt`

#### `CustomerStaffBinding`

客户与固定坐席之间的持久绑定关系。

关键字段：

- `customerZammadId`
- `staffZammadId`
- `region`
- `source`
- `isActive`
- `deactivatedAt`

这是当前 binding-first 自动分配模型的核心表。

---

### AI 模型

#### `AiConversation`

客户 AI 对话主记录。

关键字段：

- `customerId`
- `customerEmail`
- `status`
- `lastMessageAt`

#### `AiMessage`

AI 对话中的消息。

关键字段：

- `conversationId`
- `senderRole`
- `senderId`
- `content`
- `messageType`
- `metadata`

#### `AiMessageRating`

用户对 AI 消息的正 / 负反馈。

关键字段：

- `messageId`
- `userId`
- `rating`
- `feedback`

#### `AiQaReview`

坐席对 AI 回复的 QA 审核记录。

关键字段：

- `messageId`
- `status`
- `reviewNote`
- `reviewedBy`
- `reviewedAt`
- `retestAnswer`
- `retestAppId`
- `source`
- `appId`
- `externalId`

---

## 索引与关系

当前 schema 已围绕这些场景建立索引：

- FAQ 分类 / 文章查询
- 翻译按 locale 查询
- 未读 / 最近通知查询
- TicketUpdate 按 ticket / time 查询
- AI message 按 conversation / time 查询
- Binding 按 active / region / staff 查询

具体索引和外键约束仍以 `prisma/schema.prisma` 为准。

---

## Prisma 使用模式

`src/lib/prisma.ts` 使用单例模式，避免开发环境热更新产生过多 client 实例。

常见使用位置：

- FAQ API：`src/app/api/faq/*`
- 通知服务：`src/lib/notification/service.ts`
- AI 对话服务与 API
- Binding 逻辑：`src/lib/ticket/customer-binding.ts`
- Webhook 持久化：`src/app/api/webhooks/zammad/route.ts`

---

## 迁移

迁移目录：

- `prisma/migrations/`

常用命令：

```bash
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
```

仓库中还有：`prisma.config.ts`

---

## Seed

FAQ seed 通过以下命令写入：

```bash
npm run db:seed
```

脚本位置：`prisma/seed.ts`

---

## 文档边界提醒

整理数据库相关文档时，要一直守住这条边界：

- **Prisma / PostgreSQL** = 本地支撑数据
- **Zammad** = 工单运行真相

过去很多文档漂移，都是因为把这两层写混了。

---

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [API-REFERENCE.md](./API-REFERENCE.md)
- [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md)
