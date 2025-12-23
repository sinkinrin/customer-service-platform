# 技术设计：自动化测试体系

## 上下文

### 背景
- 项目使用 Next.js 16 (App Router) + TypeScript
- 当前无任何测试基础设施
- 外部依赖：Zammad API、FastGPT AI、Prisma/SQLite
- 需要支持多角色（Customer/Staff/Admin）测试

### 约束
- 测试不应影响生产数据
- 测试应能在 CI 环境快速运行
- 需要 Mock 外部服务（Zammad、AI）
- 需要支持多语言（i18n）测试

### 利益相关者
- 开发团队：编写和维护测试
- QA 团队：执行手动测试、审查自动化测试
- 运维团队：CI/CD 集成

## 目标 / 非目标

### 目标
- 建立完整的测试金字塔（单元 → 集成 → E2E）
- 自动生成可视化测试报告
- 集成 CI/CD 流水线
- 提供手动测试支持文档
- 达到 80% 代码覆盖率

### 非目标
- 性能测试（后续单独规划）
- 安全测试（后续单独规划）
- 视觉回归测试（后续单独规划）
- 移动端原生测试（仅 Web 响应式）

## 决策

### 决策 1：测试框架选择

**选择：Vitest + Playwright**

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Vitest** ✅ | 与 Vite/Next.js 集成好、速度快、ESM 原生支持 | 生态略小于 Jest |
| Jest | 生态成熟、文档丰富 | 配置复杂、ESM 支持差 |

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Playwright** ✅ | 跨浏览器、自动等待、Trace 调试 | 学习曲线 |
| Cypress | 开发体验好 | 跨浏览器支持差、付费功能多 |

**理由**：
- Vitest 与 Next.js 16 兼容性更好
- Playwright 提供更好的跨浏览器支持和调试能力
- 两者都有活跃的社区和良好的 TypeScript 支持

### 决策 2：Mock 策略

**选择：MSW (Mock Service Worker) + Vitest Mock**

```
┌─────────────────────────────────────────────────────────┐
│                      测试环境                            │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ 单元测试     │    │ API 测试    │    │ E2E 测试    │ │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    MSW                          │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │   │
│  │  │ Zammad  │  │ FastGPT │  │ 其他外部 API    │ │   │
│  │  │  Mock   │  │  Mock   │  │     Mock        │ │   │
│  │  └─────────┘  └─────────┘  └─────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              测试数据库 (SQLite)                 │   │
│  │              内存模式 / 临时文件                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Mock 分层**：

| 层级 | Mock 方式 | 说明 |
|------|-----------|------|
| HTTP 请求 | MSW | 拦截 Zammad/AI 等外部 API |
| NextAuth | vi.mock | 模拟认证状态 |
| Prisma | 内存 SQLite | 真实数据库操作，测试后清理 |
| 文件系统 | memfs | 测试本地对话存储 |
| 时间 | vi.useFakeTimers | 测试时间相关逻辑 |

### 决策 3：测试数据管理

**选择：Fixture 文件 + Factory 函数**

```typescript
// __tests__/fixtures/users.ts
export const testUsers = {
  customer: {
    id: 'test-customer-id',
    email: 'customer@test.com',
    role: 'customer',
    region: 'asia-pacific',
  },
  staff: {
    id: 'test-staff-id',
    email: 'staff@test.com',
    role: 'staff',
    region: 'asia-pacific',
  },
  admin: {
    id: 'test-admin-id',
    email: 'admin@test.com',
    role: 'admin',
  },
}

// __tests__/factories/conversation.ts
export function createConversation(overrides = {}) {
  return {
    id: `conv_${Date.now()}`,
    customer_id: testUsers.customer.id,
    mode: 'ai',
    status: 'active',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}
```

### 决策 4：测试报告格式

**选择：多格式输出**

| 格式 | 用途 | 工具 |
|------|------|------|
| HTML | 本地查看、分享 | Vitest UI / Playwright HTML Reporter |
| LCOV | 覆盖率集成 | c8 |
| JUnit XML | CI/CD 集成 | vitest-junit-reporter |
| JSON | 自动化处理 | 内置 |

**报告目录结构**：
```
project/
├── coverage/                    # 覆盖率报告
│   ├── index.html              # 覆盖率概览
│   ├── lcov.info               # LCOV 格式
│   └── coverage-summary.json   # JSON 摘要
├── test-results/               # 测试结果
│   ├── html/                   # HTML 报告
│   │   └── index.html
│   ├── junit.xml               # JUnit 格式
│   └── results.json            # JSON 格式
└── playwright-report/          # E2E 报告
    ├── index.html              # Playwright 报告
    └── trace/                  # 失败测试的 Trace
```

### 决策 5：CI/CD 集成

**选择：GitHub Actions + 分层执行**

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  api-test:
    runs-on: ubuntu-latest
    needs: unit-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:api
      - uses: actions/upload-artifact@v4
        with:
          name: api-test-results
          path: test-results/

  e2e-test:
    runs-on: ubuntu-latest
    needs: api-test
    if: github.ref == 'refs/heads/main'  # 仅主分支
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**执行策略**：
- **PR**：单元测试 + API 测试（快速反馈）
- **Main 分支**：全部测试（完整验证）
- **定时任务**：每日全量 E2E 测试

## 风险 / 权衡

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 测试运行时间过长 | 开发效率下降 | 分层执行、并行化、仅运行相关测试 |
| Mock 与真实 API 不一致 | 测试通过但生产失败 | 定期更新 Mock、合约测试 |
| E2E 测试不稳定 | CI 频繁失败 | 自动重试、等待策略、隔离测试数据 |
| 覆盖率指标误导 | 测试质量低 | 关注关键路径、代码审查测试质量 |

## 迁移计划

### 阶段 1：基础设施（1-2 天）
1. 安装依赖
2. 创建配置文件
3. 创建目录结构
4. 验证基本运行

### 阶段 2：单元测试（3-5 天）
1. 编写 Schema 测试
2. 编写工具函数测试
3. 编写 Store 测试
4. 达到 60% 覆盖率

### 阶段 3：API 测试（3-5 天）
1. 配置 MSW
2. 编写认证 API 测试
3. 编写核心 API 测试
4. 达到 80% 覆盖率

### 阶段 4：E2E 测试（3-5 天）
1. 编写认证流程测试
2. 编写 Customer 流程测试
3. 编写 Staff 流程测试
4. 编写 Admin 流程测试

### 阶段 5：CI/CD 集成（1-2 天）
1. 创建 GitHub Actions
2. 配置报告上传
3. 配置分支保护

### 回滚计划
- 测试代码独立于业务代码，可随时删除
- 配置文件可快速回退
- CI/CD 可禁用测试步骤

## 开放问题

1. **是否需要视觉回归测试？**
   - 可使用 Playwright 截图对比
   - 建议后续单独规划

2. **是否需要性能测试？**
   - 可使用 Lighthouse CI
   - 建议后续单独规划

3. **测试数据库是否需要持久化？**
   - 当前使用内存 SQLite
   - 如需调试可切换到文件模式

4. **E2E 测试是否需要真实 Zammad？**
   - 当前使用 Mock
   - 可配置环境变量切换到真实服务

## 附录：配置文件示例

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['__tests__/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/**/types/**'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
    reporters: ['default', 'html', 'junit'],
    outputFile: {
      html: './test-results/html/index.html',
      junit: './test-results/junit.xml',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
  },
})
```

### package.json 脚本
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:api": "vitest run --coverage --include='__tests__/api/**'",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage --reporter=html"
  }
}
```
