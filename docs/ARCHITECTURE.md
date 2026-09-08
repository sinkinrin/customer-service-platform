# 系统架构

> 客户服务平台当前实现架构说明。

**最后更新**：2026-09-08
**当前版本**：`0.6.0`

## 总览

当前系统是一个基于 Next.js 16 App Router 的单仓三端平台：

- **Customer**：FAQ、AI 对话、建单、工单跟踪、附件回复
- **Staff**：工单处理、分配流程、AI 助手、AI QA review
- **Admin**：用户 / FAQ / AI 设置 / customer-staff binding / 统计与运维配置

当前运行边界：

- **Next.js** 负责页面、Route Handlers 和服务端组件
- **Zammad** 仍然是 ticket、ticket article、group 路由以及大量用户数据的事实来源
- **Prisma + PostgreSQL** 负责本地支撑数据，如 FAQ、通知、上传文件元数据、工单评分、TicketUpdate、AI 对话与审核数据、customer-staff binding
- **AI provider** 可配置，代码中存在 FastGPT、OpenAI-compatible、Yuxi legacy 三条路径

## 技术栈

| 层 | 当前实现 |
|----|----------|
| Framework | Next.js 16 App Router |
| UI | React 19 + Tailwind CSS + shadcn/ui |
| Language | TypeScript 5.3 |
| Auth | NextAuth.js v5 + JWT Session |
| Database | Prisma 6.19 + PostgreSQL |
| Ticketing | Zammad REST API |
| Realtime | SSE + 轮询兜底 |
| i18n | next-intl（6 种语言） |
| Forms / Validation | React Hook Form + Zod |
| State | Zustand + SWR |
| Testing | Vitest + Playwright |

## 关键入口

- 根布局与 Provider：`src/app/layout.tsx`
- 认证配置：`src/auth.ts`
- 路由保护：`middleware.ts`
- Prisma 单例：`src/lib/prisma.ts`
- Zammad 客户端：`src/lib/zammad/client.ts`
- 自动分配：`src/lib/ticket/auto-assign.ts`
- 固定绑定：`src/lib/ticket/customer-binding.ts`
- SSE Stream：`src/app/api/tickets/updates/stream/route.ts`
- SSE Emitter：`src/lib/sse/emitter.ts`
- Webhook 入站：`src/app/api/webhooks/zammad/route.ts`
- AI Provider Registry：`src/lib/ai/providers/index.ts`

## 应用结构

### 页面与 API

- `src/app/(auth)/` - 登录与认证页面
- `src/app/customer/` - 客户门户
- `src/app/staff/` - 坐席门户
- `src/app/admin/` - 管理端
- `src/app/api/` - 平台 API 路由

### 共享模块

- `src/components/` - UI 与业务组件
- `src/lib/zammad/` - Zammad API 集成
- `src/lib/ticket/` - 分配、绑定、邮件路由等工单逻辑
- `src/lib/notification/` - 站内通知服务
- `src/lib/sse/` - SSE 广播
- `src/lib/utils/` - 认证、权限、日志、AI 配置等工具
- `src/hooks/` - 客户端共享 hook
- `messages/` - 多语言文案
- `prisma/` - schema、migration、seed

## 根 Provider 结构

`src/app/layout.tsx` 当前按以下顺序串联：

1. `SessionProvider`
2. `NextIntlClientProvider`
3. `TicketUpdatesProvider`
4. `NotificationProvider`
5. `Toaster`

也就是说，认证、多语言、工单实时更新和通知中心都在根布局统一接入。

## 认证与权限模型

认证在 `src/auth.ts` 中采用多策略顺序：

1. 有 Zammad 配置时优先走 Zammad 认证
2. 启用 mock auth 时回退到 mock 用户
3. mock 关闭且配置了 env fallback 用户时，允许单账号兜底登录

当前 session 事实：

- JWT strategy
- `maxAge = 1 day`
- `updateAge = 12 hours`
- `trustHost = true`
- 仅生产环境启用 secure cookies

权限保护以 `middleware.ts` 为主，`src/auth.ts` 的 `authorized` 回调做补充防线。

角色：

- `customer`
- `staff`
- `admin`

工单级权限还会经过 `src/lib/utils/permission.ts` 的 owner / customer / group 规则过滤。

## 工单架构

### 真相来源

Zammad 是以下数据的真相来源：

- ticket
- ticket article / reply
- 组与 owner 分配状态
- 大量用户信息与坐席元数据

平台负责把这些能力包装成统一 API、权限模型、通知与 UI 流程。

### 当前分配模型

客户的长期服务归属由 `CustomerGroupAssignment → ServiceGroup` 决定，网页建单和批量未分配工单处理使用服务分组固定负责人。

启用 `EMAIL_CC_AUTO_ASSIGN_ENABLED=true` 后，新邮件工单在待分配区首次路由时优先使用首封客户来信 CC 中唯一具备目标区域完整权限的可用坐席，否则回退服务分组负责人。该开关默认关闭，关闭时保留 CC 展示并使用原服务分组负责人。CC 不改变长期服务归属，后续回复不触发改派；管理员明确改派及服务分组迁移继续生效。完整规则和并发边界见 [Zammad 集成](./ZAMMAD-INTEGRATION.md#当前分配模型)。

关键文件：

- `src/lib/ticket/email-ticket-routing.ts`
- `src/lib/service-groups/customer-assignment-service.ts`
- `src/lib/service-groups/ticket-migration-service.ts`
- `src/app/api/tickets/auto-assign/route.ts`

## 实时更新链路

当前实时链路是：

1. Zammad webhook 打到 `POST /api/webhooks/zammad`
2. 路由推断事件类型：`created` / `article_created` / `assigned` / `status_changed`
3. 写入本地 `TicketUpdate`
4. 最佳努力创建持久化通知
5. 通过 `sseEmitter.broadcast()` 定向广播
6. 前端由 `TicketUpdatesProvider` 消费
7. SSE 不可用时回退到 `GET /api/tickets/updates` 轮询

关键文件：

- `src/app/api/webhooks/zammad/route.ts`
- `src/lib/sse/emitter.ts`
- `src/app/api/tickets/updates/stream/route.ts`
- `src/app/api/tickets/updates/route.ts`
- `src/components/providers/ticket-updates-provider.tsx`

## 通知系统

站内通知是本地持久化能力，不等同于 SSE：

- Prisma 模型：`Notification`
- 服务层：`src/lib/notification/service.ts`
- API：`src/app/api/notifications/*`
- 客户端 polling：`src/lib/hooks/use-notifications.ts`
- Provider：`src/components/providers/notification-provider.tsx`

其中：

- `TicketUpdatesProvider` 负责实时 toast / 工单更新处理
- `NotificationProvider` 负责通知中心数据的轮询刷新

## FAQ 架构

FAQ 当前是 **本地 Prisma 驱动**，不是 Zammad Knowledge Base。

当前能力包括：

- 客户侧 FAQ 列表与详情 API：`src/app/api/faq/*`
- Admin 分类/文章 CRUD：`src/app/api/admin/faq/*`
- 多语言翻译：`FaqArticleTranslation`
- FAQ 点赞/点踩：`POST /api/faq/[id]/rating`
- 基于标题/内容/关键词的简单搜索：`src/app/api/faq/route.ts`
- 轻量内存缓存：`src/lib/cache/simple-cache.ts`

## 文件与附件处理

当前有两条不同的文件链路：

1. **Zammad 附件链路**
   - 上传：`src/app/api/attachments/upload/route.ts`
   - 下载：`src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`
2. **本地文件元数据链路**
   - 上传：`src/app/api/files/upload/route.ts`
   - 元数据模型：`UploadedFile`

整理文档时不能把这两条链路混成同一种存储模式。

## AI 架构

AI 不是单一 FastGPT 绑定实现，当前代码存在多 provider：

- `fastgpt`
- `openai`
- `yuxi-legacy`

客户 AI 对话当前重点行为：

- `/api/ai/chat` 支持同步和 SSE 流式返回
- FastGPT 流式路径通过 `withEvidencePersistence()` 在服务端累积文本、提取有界引用证据并持久化 AI 回复；上游完成标记后保留短证据等待窗口，再发送本地最终 `done`
- AI SSE 链路使用独立的上游 idle watchdog（默认 180 秒）和下游注释心跳（默认 15 秒）；心跳不计入回答、证据或持久化，也不会重置上游 watchdog。可分别通过 `AI_STREAM_IDLE_TIMEOUT_MS` 和 `AI_STREAM_HEARTBEAT_INTERVAL_MS` 调整，反向代理读取超时必须大于应用 idle timeout
- 服务端不再向浏览器直接透传 FastGPT 原始工具和知识库事件；staff/admin 可收到规范化 `evidence` 事件，customer 不会收到
- 客户端 `useStreamingChat()` 通过 `evidence` 和 `persisted` SSE 事件分别接收回答证据与真实消息 ID
- `/staff/conversations/{id}` 在每条带证据的 AI 消息操作区右侧提供默认折叠的引用按钮，历史消息从 `AiMessage.metadata.aiEvidence` 恢复
- `addMessage()` 对 AI 消息带有短时间幂等保护，避免流式迁移期双写重复

staff AI 助手当前边界：

- 入口路由是 `/api/staff/ai/chat`
- 上游 chatId 按 `staff-{userId}-{sessionId}` 隔离
- 仅维持面板会话上下文，不写入客户 AI 对话表

关键文件：

- `src/lib/utils/ai-config.ts`
- `src/lib/ai/providers/index.ts`
- `src/app/api/ai/chat/route.ts`
- `src/app/api/staff/ai/chat/route.ts`
- `src/hooks/use-streaming-chat.ts`
- `src/lib/ai/stream-client.ts`
- `src/lib/ai/stream-helpers.ts`
- `src/lib/ai/fastgpt-evidence.ts`
- `src/lib/ai-conversation-service.ts`

## 国际化

当前 `next-intl` 支持语言：

- `en`
- `zh-CN`
- `fr`
- `es`
- `ru`
- `pt`

定义位置：`src/i18n.ts`
文案位置：`messages/`

## 测试架构

当前测试分成两层：

- **Vitest**：单元 / 组件 / lib / route 测试
- **Playwright**：端到端流程测试

关键配置文件：

- `vitest.config.ts`
- `playwright.config.ts`
- `__tests__/setup.ts`
- `.github/workflows/test.yml`

## 文档边界

推荐这样理解当前文档系统：

- `README.md` - 项目总览与快速启动
- `docs/` - 当前实现与运维 / 开发参考
- `openspec/` - 少量当前规格与长期约束

如果历史文档与代码冲突，先信代码，再修正文档。

## 相关文档

- [AUTHENTICATION.md](./AUTHENTICATION.md)
- [DATABASE.md](./DATABASE.md)
- [API-REFERENCE.md](./API-REFERENCE.md)
- [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md)
- [TESTING.md](./TESTING.md)
