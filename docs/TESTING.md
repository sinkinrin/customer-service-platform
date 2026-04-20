# 测试指南

> 当前测试栈、覆盖范围与执行方式。

**最后更新**：2026-04-20

---

## 测试栈

| 类型 | 工具 | 主要用途 |
|------|------|----------|
| 单元 / lib / route / component | Vitest | 工具函数、服务层、API handler、组件行为 |
| API 集成风格测试 | Vitest + mocks / MSW | 路由处理与依赖隔离验证 |
| E2E | Playwright | 登录、门户流程、通知、附件、跨角色行为 |

关键配置文件：

- `vitest.config.ts`
- `playwright.config.ts`
- `__tests__/setup.ts`
- `.github/workflows/test.yml`

---

## 常用命令

```bash
npm run test
npm run test:watch
npm run test:ui
npm run test:coverage
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:all
npm run type-check
```

这些命令来自 `package.json`。

---

## 当前目录结构

### Vitest

- `__tests__/api/` - API 路由测试
- `__tests__/components/` - 组件测试
- `__tests__/unit/` - 工具/配置/服务单元测试
- `__tests__/lib/` - 更贴近业务模块的库测试
- `__tests__/scenarios/` - 场景测试
- `src/**/*.{test,spec}.*` - 也会被 Vitest 收集

### Playwright

- `e2e/*.spec.ts`

---

## 当前覆盖范围（按代码事实）

### API 路由

当前仓库已存在较多 API 测试文件，例如：

- auth
- FAQ
- notifications
- files
- user profile / preferences / avatar
- tickets
- ticket articles / attachments / assign / reopen / rating / updates / export / search / auto-assign
- staff available / vacation
- admin stats / admin settings / admin triggers / admin users / customer bindings
- conversations / message rating / AI routes
- webhook-zammad

这已经明显超出旧文档里“API 测试很少”的描述。

### 业务库 / 单元

当前已有测试覆盖的典型模块包括：

- `zammad-client`
- `notification-service`
- `env` / `env-validation`
- `routes`
- `regions`
- `region-auth`
- `auth-utils`
- `simple-cache`
- `email-user-welcome`
- `email-ticket-routing`
- `ticket/agent-helpers`
- `ticket/customer-binding`
- `ticket/auto-assign`
- Zustand stores
- stream helpers / stream client

### 组件

当前已有测试的典型组件包括：

- `message-input`
- `protected-route`
- `ticket-detail`
- `notification-center`
- `breadcrumb`
- `empty-state`

### E2E

当前 E2E 文件覆盖的主线包括：

- auth
- admin portal
- customer portal
- staff portal
- navigation
- notifications
- accessibility
- complete flows
- cross-role flows
- customer extended flows
- staff vacation
- ticket attachments

---

## Vitest 配置事实

`vitest.config.ts` 当前重要设置：

- `environment: 'jsdom'`
- `globals: true`
- `setupFiles: ['./__tests__/setup.ts']`
- 同时收集 `__tests__/**` 和 `src/**` 中的测试文件
- 覆盖率 provider: `v8`
- 覆盖率阈值：
  - statements: 80
  - branches: 70
  - functions: 85
  - lines: 80
- reporters: default + html + junit

---

## Playwright 配置事实

`playwright.config.ts` 当前重要设置：

- `testDir: './e2e'`
- 默认 base URL: `http://localhost:3010`
- `webServer.command = 'npm run dev'`
- CI 下：
  - `retries = 2`
  - `workers = 1`
- 默认项目：`chromium`
- 产出目录：`playwright-report/` 与 `test-results/e2e`

---

## 测试初始化

`__tests__/setup.ts` 当前会做这些基础准备：

- 引入 `@testing-library/jest-dom/vitest`
- 启动和关闭 MSW server
- 在每个测试后清理 render 与 mock handlers
- mock `next/navigation`

这意味着组件和部分 route 测试依赖这层统一初始化，而不是每个文件重复 setup。

---

## CI 事实

GitHub Actions 工作流位于：

- `.github/workflows/test.yml`

当前工作流会：

- 安装依赖
- 安装 Playwright Chromium
- 复制 `.env.example` 到 `.env.local`
- 执行 `npx prisma generate`
- 执行 `npx prisma db push`
- 运行 `npm run test:e2e`
- 上传 Playwright report

所以测试文档不应继续假设旧的 CI 步骤或旧目录结构。

---

## 运行建议

### 做后端或共享逻辑修改时

至少考虑：

- `npm run test`
- `npm run type-check`

### 做路由、认证、工单、通知、AI 相关修改时

优先关注对应 API / lib 测试，以及必要时的 E2E。

### 做前端交互修改时

除了类型检查和测试，还应尽量做实际界面验证；自动化测试不能完全替代真实交互检查。

---

## 文档边界提醒

旧测试文档中的这些说法已经不可靠：

- API 测试极少
- Zammad client 零测试
- 只有少量组件测试
- E2E 文件数量很少

当前应以 `__tests__/`、`e2e/`、`vitest.config.ts`、`playwright.config.ts` 和 CI workflow 为准。

---

## 相关文件

- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `__tests__/setup.ts`
- `.github/workflows/test.yml`
