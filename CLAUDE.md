# CLAUDE.md

本文件是本仓库的 Claude Code 协作说明。项目级规则以 [`AGENTS.md`](./AGENTS.md) 为准；如果本文件与代码或 `AGENTS.md` 冲突，优先遵循 `AGENTS.md` 和当前代码。

## 项目概览

这是一个基于 Next.js App Router 的三端客户服务平台，面向 Customer、Staff 和 Admin，集成 FAQ、AI 对话、工单、通知、分配和管理能力。

当前事实：

- Next.js 16、React 19、TypeScript
- NextAuth.js v5 Credentials + JWT Session
- Prisma 6.19 + PostgreSQL
- Zammad REST API 是工单、文章和大量用户信息的外部事实来源
- 本地 Prisma 数据包括 FAQ、通知、上传文件元数据、评分、TicketUpdate、AI 对话和 QA 数据
- 工单实时更新链路为 webhook → `TicketUpdate` → SSE，客户端保留 polling fallback
- AI provider 支持 FastGPT、OpenAI-compatible 和 Yuxi legacy
- 单元 / API 测试使用 Vitest，浏览器流程使用 Playwright

## 重要目录

```text
src/app/                 页面、Route Handlers 和 API
src/auth.ts              认证配置
middleware.ts            路由保护补充层
src/lib/zammad/          Zammad client、用户映射和健康检查
src/lib/ticket/          工单分配、绑定、邮件路由和坐席辅助
src/lib/service-groups/  服务组与客户分配
src/lib/ai/              流式基础设施和 provider
src/lib/ai-qa/           AI QA 业务逻辑
src/lib/notification/    本地通知服务
src/lib/stores/          Zustand stores
prisma/                  schema、migrations 和 seed
messages/                多语言文案
__tests__/               Vitest 单元、组件、API 和场景测试
e2e/                     Playwright 测试
docs/                    当前实现、运维说明和审计记录
openspec/                当前长期规格和约束
```

## 开发环境

推荐使用 Node.js 20（CI 使用 Node.js 20）。先安装 PostgreSQL、可访问的 Zammad 实例，并复制 `.env.example` 为 `.env.local`。

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

开发服务器默认地址为 `http://localhost:3010`。

生产环境至少需要：

```env
AUTH_SECRET=至少 32 个字符的随机值
DATABASE_URL=postgresql://...
ZAMMAD_URL=https://...
ZAMMAD_API_TOKEN=...
ZAMMAD_WEBHOOK_SECRET=...
```

`AUTH_SECRET` 兼容 `NEXTAUTH_SECRET`，但新配置优先使用 `AUTH_SECRET`。`NEXT_PUBLIC_ENABLE_MOCK_AUTH` 只用于开发、演示和测试，生产环境会被阻止。

## 常用命令

```bash
npm run dev             # 开发服务器
npm run build           # Prisma generate + Next build
npm run start           # 生产启动脚本
npm run lint            # ESLint
npm run type-check      # TypeScript 检查
npm run test            # Vitest
npm run test:coverage   # Vitest 覆盖率
npm run test:e2e        # Playwright
npm run test:all        # 单元测试 + E2E
npm run i18n:check      # 翻译完整性和硬编码检查
```

## 实际工作流程

### 1. 先确认范围和事实来源

- 读取 `AGENTS.md`；涉及规划、提案、重大能力或架构变化时读取 `openspec/AGENTS.md`、`openspec/project.md`。
- 使用 `rg` 精确搜索，已知路径直接读取；不要使用语义检索工具。
- 先看 `package.json`、相关入口代码、测试和当前文档，再判断旧文档是否过时。
- 文档与代码冲突时，以代码为准，然后修正文档。

### 2. 判断应修改的位置

- 当前实现事实、运行说明、运维说明：写入 `docs/`。
- 仍会长期影响系统判断的行为或约束：写入 `openspec/specs/`。
- 一次性执行计划、已完成任务和历史中间产物不要重新堆积到 OpenSpec。
- 业务代码修改应尽量复用现有 service、client、provider、helper 和类型。

### 3. 修改代码时同步考虑测试

- 修改 API、认证、工单、分配、通知、AI 或数据模型时，检查并更新对应测试。
- API 边界、表单输入和外部依赖交互处使用现有校验方案，通常为 Zod 和统一 response helper。
- 工单相关逻辑同时确认 Zammad 权限、customer-staff binding、region / group 规则及本地支撑数据的一致性。
- AI 流式逻辑同时检查 SSE 解析、持久化、幂等和客户端缓存行为。

### 4. 验证和交付

按变更范围执行：

```bash
npm run lint
npm run type-check
npm run test
npm run i18n:check       # 涉及文案或多语言时
npm run test:e2e         # 涉及页面、认证或关键用户流程时
npm run build            # 涉及生产构建、依赖或路由时
```

交付时说明修改文件、验证命令及未解决的问题。不要把密钥、真实账号或 `.env.local` 内容写入仓库或回复。

## 文档和规格规则

OpenSpec 使用精简保留模式：

1. 先检查 `openspec/specs/` 是否已有对应规格。
2. 当前事实优先更新 `docs/`。
3. 只有长期有效的跨模块约束才新增或修改规格。
4. 旧 proposal、tasks、archive 如果已经没有参考价值，可以删除；不要为了保留历史而继续维护。

相关入口：

- [项目总览](./README.md)
- [文档索引](./docs/README.md)
- [开发与测试工作流](./docs/DEVELOPMENT-WORKFLOW.md)
- [OpenSpec 项目上下文](./openspec/project.md)

## 安全边界

- 不提交 API key、密码、token、真实客户数据或生产 URL 中的敏感凭据。
- 不在生产启用 mock auth。
- 认证、权限和工单可见性修改后必须增加或运行对应测试。
- 不执行 `git reset --hard`、`git checkout --` 等会覆盖用户改动的命令。
- 不修改与当前任务无关的未提交文件。
