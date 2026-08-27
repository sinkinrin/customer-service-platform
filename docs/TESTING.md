# 测试指南

> 当前测试栈、覆盖范围与执行方式。

**最后更新**：2026-07-28

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
npm run test:coverage:ci
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:all
npm run type-check
```

这些命令来自 `package.json`。

## 安全边界

- 默认 Vitest 必须使用 mock 或不可连接的本地占位地址，不能读取或写入生产 PostgreSQL / Zammad。
- `__tests__/api/conversations-real.test.ts` 默认跳过。只有同时满足 `RUN_DATABASE_INTEGRATION_TESTS=true` 且 `DATABASE_URL` 的数据库名包含由 `.`, `_`, `-` 分隔的独立 `test` / `e2e` 命名段时才会执行，否则拒绝运行；`latest`、`contest` 等子串不视为测试库。
- Playwright 流程可能创建用户、工单、回复和附件。只允许连接专用测试数据库与隔离 Zammad；不得把生产地址、token 或生产 `.env.local` 用于 E2E。
- Playwright 默认拒绝启动；必须设置 `RUN_ISOLATED_E2E=true`，数据库名必须包含由 `.`, `_`, `-` 分隔的独立 `test` / `e2e` 命名段。默认只允许 loopback PostgreSQL/Zammad；专用远程测试系统还需显式设置 `ALLOW_REMOTE_E2E_SERVICES=true`。
- Playwright 不复用已经运行的本地 server，避免测试误接到以共享或生产凭据启动的进程。运行前应先释放 3010 端口。
- 禁止在共享或生产数据库上执行 `prisma db push`、迁移、seed 或测试清理脚本。

安全运行 Vitest 的 PowerShell 示例：

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/unit_test'
$env:ZAMMAD_URL='http://127.0.0.1:65535/'
$env:ZAMMAD_API_TOKEN='test-only-placeholder'
$env:RUN_DATABASE_INTEGRATION_TESTS='false'
npm run test
```

不可连接地址是防误连措施，测试日志中可能出现预期的连接失败信息；应以最终测试退出码为准。

依赖或 lockfile 发生变化后，先执行一次干净的 `npm ci`，再运行 lint、类型检查、测试和构建；不能用旧 `node_modules` 的结果证明新依赖组合兼容。

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
- 配置加载时执行 isolated E2E 安全校验
- `reuseExistingServer = false`
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
- 使用不可连接的本地占位 PostgreSQL / Zammad 地址运行单元、API 和覆盖率测试
- 用当前覆盖率基线作为 CI 防回退门槛：statements 66%、branches 51%、functions 66%、lines 67%
- 执行 ESLint、TypeScript 检查和 Prisma Client 生成
- 监听 `master`、`main`、`develop` 的 push / pull request
- 默认跳过 E2E；只有仓库变量 `ENABLE_ISOLATED_E2E=true` 且满足工作流分支条件时才进入 E2E job
- E2E job 还会显式设置 `RUN_ISOLATED_E2E=true`
- E2E job 使用独立 PostgreSQL service，不复用应用或生产数据库
- 上传覆盖率、Vitest 结果和启用后的 Playwright 结果

当前 E2E job 将 Zammad 指向不可连接的本地端口，因此即使显式启用，也不会误写生产 Zammad；依赖真实工单链路的用例需要先配置隔离 Zammad 或可靠 mock，不能通过替换为生产地址来“让测试通过”。

仓库目标阈值为 statements 80%、branches 70%、functions 85%、lines 80%。截至 2026-07-22，完整测试本身通过，但全局覆盖率仍低于目标，因此 `npm run test:coverage` 会失败。CI 暂时通过 `npm run test:coverage:ci` 执行当前基线防回退，覆盖率继续下降会阻断；目标阈值本身没有下调，后续应通过补测逐步提高 CI 基线。

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
