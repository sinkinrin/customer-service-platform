# 测试指南

本文档介绍如何在 Customer Service Platform 项目中运行和编写测试。

## 测试框架

| 类型 | 框架 | 用途 |
|------|------|------|
| 单元测试 | Vitest | Schema 验证、工具函数、组件 |
| API 测试 | Vitest + MSW | API 端点集成测试 |
| E2E 测试 | Playwright | 端到端用户流程测试 |

## 快速开始

### 运行所有测试

```bash
# 运行单元测试
npm run test

# 运行单元测试（监视模式）
npm run test:watch

# 运行单元测试（带 UI）
npm run test:ui

# 运行单元测试（带覆盖率）
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e

# 运行 E2E 测试（带 UI）
npm run test:e2e:ui

# 运行 E2E 测试（有头模式）
npm run test:e2e:headed

# 运行所有测试
npm run test:all
```

## 目录结构

```
├── __tests__/
│   ├── setup.ts              # Vitest 全局设置
│   ├── mocks/
│   │   ├── handlers.ts       # MSW API Mock 处理器
│   │   ├── server.ts         # MSW 服务器配置
│   │   └── auth.ts           # 认证 Mock 辅助函数
│   ├── fixtures/
│   │   ├── users.ts          # 测试用户数据
│   │   ├── conversations.ts  # 测试对话数据
│   │   ├── tickets.ts        # 测试工单数据
│   │   └── faq.ts            # 测试 FAQ 数据
│   ├── api/                  # API 集成测试
│   │   ├── tickets.test.ts   # 工单 API 测试 (14 tests)
│   │   ├── auth.test.ts      # 认证 API 测试 (9 tests)
│   │   ├── faq.test.ts       # FAQ API 测试 (7 tests)
│   │   ├── admin.test.ts     # 管理员 API 测试 (6 tests)
│   │   └── conversations-real.test.ts  # 对话 API 测试
│   ├── components/           # 组件测试
│   │   ├── message-input.test.tsx     # 消息输入组件 (14 tests)
│   │   ├── protected-route.test.tsx   # 路由保护组件 (7 tests)
│   │   └── ticket-detail.test.tsx     # 工单详情组件 (15 tests)
│   ├── scenarios/            # 场景测试
│   │   ├── customer-journey.test.ts   # 客户旅程场景
│   │   ├── security-scenarios.test.ts # 安全场景
│   │   └── ...
│   └── unit/
│       ├── schemas.test.ts   # Zod Schema 测试
│       ├── zammad-client.test.ts  # Zammad 客户端测试 (31 tests)
│       └── api-response.test.ts  # API 响应工具测试
├── e2e/
│   ├── auth.spec.ts          # 认证流程 E2E 测试
│   ├── customer-portal.spec.ts   # Customer Portal E2E 测试
│   └── admin-portal.spec.ts  # Admin Portal E2E 测试
├── vitest.config.ts          # Vitest 配置
└── playwright.config.ts      # Playwright 配置
```

## 测试统计

| 类别 | 测试文件数 | 测试用例数 |
|------|-----------|-----------|
| 单元测试 | 19 | ~450 |
| API 集成测试 | 5 | 49 |
| 组件测试 | 3 | 36 |
| 场景测试 | 7 | ~150 |
| **总计** | **35** | **~694** |

## 编写单元测试

### 基本结构

```typescript
import { describe, it, expect } from 'vitest'

describe('功能模块名称', () => {
  it('should 描述预期行为', () => {
    // Arrange - 准备测试数据
    const input = { ... }
    
    // Act - 执行被测试的代码
    const result = functionUnderTest(input)
    
    // Assert - 验证结果
    expect(result).toBe(expectedValue)
  })
})
```

### 测试 Zod Schema

```typescript
import { describe, it, expect } from 'vitest'
import { MySchema } from '@/types/api.types'

describe('MySchema', () => {
  it('should accept valid data', () => {
    const data = { field: 'value' }
    const result = MySchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('should reject invalid data', () => {
    const data = { field: '' }
    const result = MySchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
```

## 使用 Mock

### MSW Mock API

MSW (Mock Service Worker) 用于拦截 HTTP 请求并返回模拟响应。

```typescript
// __tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json({
      success: true,
      data: [{ id: 1, name: 'Test User' }],
    })
  }),
]
```

### Mock 认证状态

```typescript
import { mockSession, mockUnauthenticated } from '../mocks/auth'

describe('需要认证的功能', () => {
  it('should work when authenticated', () => {
    mockSession('customer')  // 模拟 customer 登录
    // ... 测试代码
  })

  it('should redirect when not authenticated', () => {
    mockUnauthenticated()  // 模拟未登录
    // ... 测试代码
  })
})
```

## 使用 Fixtures

Fixtures 提供预定义的测试数据：

```typescript
import { testUsers, testConversations, testTickets } from '../fixtures'

describe('对话功能', () => {
  it('should display conversation', () => {
    const conversation = testConversations.aiConversation
    // 使用 fixture 数据进行测试
  })
})
```

## 编写 E2E 测试

### 基本结构

```typescript
import { test, expect } from '@playwright/test'

test.describe('功能模块', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前的设置
    await page.goto('/login')
  })

  test('should 描述预期行为', async ({ page }) => {
    // 执行用户操作
    await page.fill('input[name="email"]', 'test@example.com')
    await page.click('button[type="submit"]')
    
    // 验证结果
    await expect(page).toHaveURL('/dashboard')
  })
})
```

### 登录辅助函数

```typescript
async function loginAsCustomer(page: Page) {
  await page.goto('/auth/login')
  await page.fill('[name="email"]', 'customer@test.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/customer\/dashboard/)
}
```

## 测试报告

### 单元测试报告

运行 `npm run test:coverage` 后，报告生成在：
- HTML 报告: `coverage/index.html`
- LCOV 报告: `coverage/lcov.info`

### E2E 测试报告

运行 `npm run test:e2e` 后，报告生成在：
- HTML 报告: `playwright-report/index.html`
- Trace 文件: `test-results/e2e/`

查看报告：
```bash
# 查看单元测试报告
npx vite preview --outDir coverage

# 查看 E2E 测试报告
npx playwright show-report
```

## CI/CD 集成

测试在 GitHub Actions 中自动运行：

- **PR 到 main/develop**: 运行单元测试 + Lint
- **Push 到 main**: 运行单元测试 + E2E 测试 + Lint

测试报告作为 Artifacts 上传，可在 Actions 页面下载。

## 最佳实践

1. **测试命名**: 使用 `should + 预期行为` 格式
2. **单一职责**: 每个测试只验证一个行为
3. **独立性**: 测试之间不应相互依赖
4. **可读性**: 使用 AAA 模式（Arrange-Act-Assert）
5. **覆盖率**: 目标 80% 以上的代码覆盖率
6. **Mock 外部依赖**: 使用 MSW mock 外部 API
7. **使用 data-testid**: E2E 测试优先使用 `data-testid` 选择器
8. **避免 waitForTimeout**: 使用 `waitForLoadState` 或等待特定元素

## 编写组件测试

### 基本结构

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from '@/components/my-component'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<MyComponent onSubmit={onSubmit} />)

    await user.type(screen.getByRole('textbox'), 'test')
    await user.click(screen.getByRole('button'))

    expect(onSubmit).toHaveBeenCalledWith('test')
  })
})
```

### Mock Hooks

```typescript
// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/test',
}))

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
```

## 编写 API 集成测试

### 基本结构

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/my-route/route'
import { NextRequest } from 'next/server'

// Mock 认证
vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}))

describe('My API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost/api/my-route')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
```

## 常见问题

### Q: 测试超时怎么办？

增加超时时间：
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000)  // 60 秒
  // ...
})
```

### Q: 如何调试测试？

```bash
# Vitest 调试
npm run test:ui

# Playwright 调试
npm run test:e2e:headed
npx playwright test --debug
```

### Q: 如何只运行特定测试？

```bash
# Vitest
npm run test -- --grep "schema"

# Playwright
npx playwright test auth.spec.ts
```
