# 技术设计：Next.js 16 升级与 PPR 优化

## 上下文

- **当前版本**：`next@14.2.25`，`react@^18.2.0`
- **目标版本**：`next@16.0.7+`，`react@^19.2.0`
- 项目使用 App Router + Middleware 进行认证和路由保护
- 项目使用 `next-intl@4.4.0` 进行国际化
- 已有 PPR 准备工作（Server/Client 分离、Suspense 边界）

## 目标

- 修复 CVE-2025-66478 安全漏洞（升级后必须使用 16.0.7+）
- 启用 PPR (`cacheComponents`) 提升首屏加载速度
- 利用 Turbopack 默认启用加快开发体验
- 利用 React 19.2 新特性（可选）

## 非目标

- 全面重构现有代码架构
- 启用 React Compiler（可后续单独评估）
- 使用 View Transitions API（可后续单独评估）

## 决策

### 1. 版本选择：16.0.7

**原因**：
- 最低安全版本，修复 CVE-2025-66478
- 稳定版本，非 canary
- 包含所有 16.0.x 的功能和优化

**备选**：
- `16.1.0-canary.12`：如需最新 canary 功能，但稳定性较低

### 2. PPR 配置：`cacheComponents: true`

```javascript
// next.config.js
const nextConfig = {
  cacheComponents: true,
  // 移除 experimental.ppr
}
```

**原因**：
- Next.js 16 统一 PPR 配置到 `cacheComponents`
- `experimental.ppr` 已废弃，使用会报错

### 3. 异步 API 迁移策略

**自动迁移**：
```bash
npx @next/codemod@latest migrate-to-async-dynamic-apis .
```

**手动检查清单**：

| 文件 | API | 当前状态 | 迁移需求 |
|------|-----|----------|----------|
| `src/i18n.ts` | `cookies()` | ✅ 已 await | 无需修改 |
| `src/lib/utils/cookies.ts` | `cookies()` | ✅ 已 await | 无需修改 |
| 动态路由页面 | `params` | 使用 `useParams()` | **无需迁移**（客户端 hook） |

**关键点**：
- 项目中动态路由页面（如 `[id]/page.tsx`）都是 Client Component，使用 `useParams()` hook
- `useParams()` 是客户端 hook，不受异步 API 变更影响
- 只有 Server Component 中直接接收 `params` prop 才需要迁移

### 4. PPR 页面改造

**PPR 工作原理（Next.js 16）**：
1. 默认所有内容尝试预渲染
2. 网络请求/动态数据访问会触发动态渲染
3. 使用 `use cache` 显式缓存可预渲染的数据
4. 使用 `<Suspense>` 包裹动态内容

**改造示例**：

```tsx
// 之前（Next.js 14/15 canary）
export const experimental_ppr = true

async function DynamicStats() {
  const stats = await fetchStats() // 动态
  return <StatsCard stats={stats} />
}

export default function Page() {
  return (
    <div>
      <Header /> {/* 静态 */}
      <Suspense fallback={<Loading />}>
        <DynamicStats />
      </Suspense>
    </div>
  )
}
```

```tsx
// 之后（Next.js 16）
// 移除 experimental_ppr

async function CachedContent() {
  'use cache'
  const data = await fetchStaticData()
  return <StaticSection data={data} />
}

async function DynamicStats() {
  const stats = await fetchStats() // 动态，不缓存
  return <StatsCard stats={stats} />
}

export default function Page() {
  return (
    <div>
      <Header /> {/* 静态 */}
      <CachedContent /> {/* 缓存的数据 */}
      <Suspense fallback={<Loading />}>
        <DynamicStats /> {/* 动态流式传输 */}
      </Suspense>
    </div>
  )
}
```

### 5. next-intl 兼容性

**检查项**：
- 确认 `next-intl@4.4.0` 支持 Next.js 16
- 如不支持，升级到最新版本
- `getRequestConfig` 中的 `cookies()` 调用已正确 await

### 6. Turbopack 配置

**默认行为**：
- `next dev` 和 `next build` 默认使用 Turbopack
- 无需 `--turbo` 标志

**自定义 webpack 配置**：
- 当前项目无自定义 webpack 配置
- 如有，需要迁移或使用 `--turbopack` 忽略

### 7. 移除 staleTimes 配置

```javascript
// 移除（Next.js 16 有新的缓存机制）
experimental: {
  staleTimes: {
    dynamic: 30,
    static: 180,
  },
}
```

**原因**：
- Next.js 16 的路由缓存机制有变化
- 使用 `cacheLife` 和 `cacheTag` 替代

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| React 19 兼容性问题 | 高 | 逐步测试所有组件，特别是第三方库 |
| next-intl 不兼容 | 中 | 提前检查版本兼容性，准备升级方案 |
| PPR 配置错误 | 中 | 先在开发环境测试，观察构建输出 |
| Turbopack 构建问题 | 低 | 可回退到 webpack（`next build --webpack`） |
| 异步 API 遗漏 | 中 | 使用 codemod 自动迁移 + TypeScript 类型检查 |

## 验证计划

### 升级后检查清单

1. [ ] `npm run build` 成功，无 TypeScript 错误
2. [ ] `npm run dev` 正常启动
3. [ ] Middleware 认证正常（admin/staff/customer 路由保护）
4. [ ] 国际化正常（语言切换、翻译显示）
5. [ ] 所有页面可正常访问
6. [ ] 表单提交正常
7. [ ] API 路由正常

### PPR 验证

1. [ ] 构建输出显示 PPR 页面
2. [ ] 首页静态 shell 立即返回
3. [ ] 动态内容流式加载
4. [ ] Suspense fallback 正确显示

### 性能基准

- 首页 LCP（Largest Contentful Paint）
- TTFB（Time to First Byte）
- 构建时间
- 开发服务器启动时间

## 开放问题

1. ~~`next-intl@4.4.0` 是否支持 Next.js 16 和 React 19？~~ ✅ **已确认**：`next-intl@4.5.7` 支持 `next@^16.0.0` 和 `react@^19.0.0`，建议升级到 `4.5.7`
2. ~~`next-auth@5.0.0-beta.30` 是否支持 Next.js 16？~~ ✅ **已确认**：`next-auth@5.0.0-beta.30` 支持 `next@^16.0.0` 和 `react@^19.0.0`，可继续使用
3. 是否需要升级 shadcn/ui 组件以支持 React 19？
4. 是否启用 React Compiler 进行自动 memoization？

## 依赖版本确认

| 依赖 | 当前版本 | 目标版本 | peerDependencies |
|------|----------|----------|------------------|
| `next-intl` | `4.4.0` | `4.5.7` | `next@^16.0.0`, `react@^19.0.0` |
| `next-auth` | `5.0.0-beta.30` | `5.0.0-beta.30` | `next@^16.0.0`, `react@^19.0.0` |
