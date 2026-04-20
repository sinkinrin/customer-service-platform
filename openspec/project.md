# 项目上下文

## 项目目标

本项目是一个面向客户、坐席与管理员的客户服务平台，目标是在同一套 Web 应用中整合 FAQ、自助对话、工单流转、站内通知、分配逻辑与管理能力。

当前系统边界是：

- **Zammad** 负责外部工单与用户体系的核心交互
- **Prisma + PostgreSQL** 负责本地支撑数据，例如 FAQ、通知、评分、上传文件、AI 对话与质检数据
- **Next.js App Router** 负责页面、服务端组件和 API Routes
- **FastGPT** 作为可选 AI 提供方，为对话能力提供支持

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript 5.3
- NextAuth.js v5（JWT Sessions）
- Prisma 6.19 + PostgreSQL
- Zammad REST API
- next-intl（6 种语言）
- Vitest + Playwright
- 可选 FastGPT 集成

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
- AI 能力通过 provider 层接入，当前主要 provider 是 FastGPT

### 测试策略

- 使用 Vitest 进行单元测试与集成测试
- 使用 Playwright 进行 E2E 测试
- 当修改认证、工单、分配、通知、AI 或 API 合约时，应同步更新相关测试
- 文档整理过程中，优先验证“当前代码路径”而不是沿用旧文档结论

### Git 工作流

- 当前主分支是 `master`
- 最近提交主要采用 Conventional Commit 风格（如 `feat:`、`fix:`、`docs:`、`chore:`）
- 已完成的 OpenSpec 变更提案归档在 `openspec/changes/archive/`
- 版本标签当前主要出现在 `v0.2.x` 范围

## 业务上下文

- **Customer**：查看 FAQ、发起 AI 对话、创建与跟踪工单、上传附件
- **Staff**：处理工单、回复客户、处理分配、查看或复核 AI 结果
- **Admin**：管理用户、FAQ、配置项，以及 customer-staff binding 等管理能力
- **工单真相来源**：Zammad
- **本地支撑数据**：FAQ、UploadedFile、TicketRating、ReplyTemplate、TicketUpdate、Notification、AiConversation、AiMessage、AiMessageRating、AiQaReview
- **当前分配模型**：以 customer-staff binding 与 binding-aware auto-assign 为核心，而不是早期文档中的简单区域分配模型

## 重要约束

- `docs/` 与 `openspec/` 的职责必须分开：`docs/` 记录当前实现，`openspec/` 记录规格 / 提案 / 设计意图
- 仓库中的历史文档可能仍包含 SQLite、旧 API 数量、旧路径或旧版本号；做判断前先核对 `package.json` 与 `prisma/schema.prisma`
- 没有 Zammad 与数据库配置时，应用可部分启动，但完整工单链路无法正常运行
- `NEXT_PUBLIC_ENABLE_MOCK_AUTH` 仅适合开发 / 演示场景，不应被当作生产认证模型
- `PROJECT-CONTEXT.md` 仅作为兼容入口保留，不应继续成为新的主引用目标

## 外部依赖

- PostgreSQL
- Zammad REST API
- 可选 FastGPT 服务
- `messages/` 目录中的多语言翻译文件
- 浏览器 SSE 能力（用于实时更新）
