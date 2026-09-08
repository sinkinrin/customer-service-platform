# 项目上下文

## 项目目标

本项目是一个面向客户、坐席与管理员的客户服务平台，目标是在同一套 Web 应用中整合 FAQ、自助对话、工单流转、站内通知、分配逻辑与管理能力。

当前系统边界是：

- **Zammad** 负责外部工单与用户体系的核心交互
- **Prisma + PostgreSQL** 负责本地支撑数据，例如 FAQ、通知、评分、上传文件、AI 对话与质检数据
- **Next.js App Router** 负责页面、服务端组件和 API Routes
- **AI provider layer** 为客户 AI 对话、staff AI 助手和 QA 流程提供可配置能力

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript 5.3
- NextAuth.js v5（JWT Sessions）
- Prisma 6.19 + PostgreSQL
- Zammad REST API
- next-intl（6 种语言）
- Vitest + Playwright
- FastGPT / OpenAI-compatible / Yuxi legacy provider

## 项目约定

### 代码风格

- 优先在现有实现基础上做小而明确的修改
- 优先复用已有的 client / service / provider / helper，而不是为一次性逻辑新增抽象
- 在 API 边界、表单输入和外部依赖交互处做校验；系统内部优先保持简单直接
- 文档中若出现与代码冲突的说法，应先核对代码，再修正文档

### 架构模式

- 页面与 API Routes 位于 `src/app/`
- 认证配置集中在 `src/auth.ts`，路由保护由 `middleware.ts` 补充
- Zammad 集成集中在 `src/lib/zammad/`
- 工单分配、路由与绑定逻辑集中在 `src/lib/ticket/`
- 本地持久化统一通过 Prisma schema 与 service 层完成
- 实时更新链路是：webhook / 本地事件记录 / SSE emitter / SSE stream
- AI 能力通过 provider 层接入，客户对话与 staff AI 助手共用流式基础设施

### 测试策略

- 使用 Vitest 进行单元测试与集成测试
- 使用 Playwright 进行 E2E 测试
- 当修改认证、工单、分配、通知、AI 或 API 合约时，应同步更新相关测试
- 文档整理过程中，优先验证“当前代码路径”而不是沿用旧文档结论

### 文档策略

- `docs/` 记录当前实现、运维说明和审计记录
- `openspec/` 只保留仍然有长期价值的当前规格与约束
- 无长期价值的 proposal、计划稿、历史归档默认直接删除，不再累计归档树

## 业务上下文

- **Customer**：查看 FAQ、发起 AI 对话、创建与跟踪工单、上传附件
- **Staff**：处理工单、回复客户、处理分配、使用 AI 助手与 QA review
- **Admin**：管理用户、FAQ、配置项，以及 customer-staff binding 等管理能力
- **工单真相来源**：Zammad
- **本地支撑数据**：FAQ、UploadedFile、TicketRating、ReplyTemplate、TicketUpdate、Notification、AiConversation、AiMessage、AiMessageRating、AiQaReview
- **当前分配模型**：以客户服务分组为长期归属；新邮件工单可由首封来信 CC 中唯一符合条件的坐席优先承接，其他情况使用服务分组负责人

## 重要约束

- 文档若提到 SQLite、旧 API 数量、旧路径、旧版本号或早期分配方案，默认视为历史说明，需先核对 `package.json`、`prisma/schema.prisma` 和当前代码
- 没有 Zammad 与数据库配置时，应用可部分启动，但完整工单链路无法正常运行
- `NEXT_PUBLIC_ENABLE_MOCK_AUTH` 仅适合开发 / 演示场景，不应被当作生产认证模型
- staff AI 面板会话与客户 AI 会话是不同的持久化边界

## 外部依赖

- PostgreSQL
- Zammad REST API
- 可选 FastGPT / OpenAI-compatible / Yuxi provider
- `messages/` 目录中的多语言翻译文件
- 浏览器 SSE 能力（用于实时更新）