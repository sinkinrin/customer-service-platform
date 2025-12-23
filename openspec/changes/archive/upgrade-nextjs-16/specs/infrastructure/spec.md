# 基础设施：Next.js 框架

## MODIFIED Requirements

### Requirement: Next.js 安全补丁
系统 SHALL 使用已修复已知安全漏洞的 Next.js 版本（16.0.7+）。

#### Scenario: CVE-2025-66478 RSC 协议保护
- **GIVEN** 系统使用 Next.js 16.0.7 或更高版本
- **WHEN** 攻击者尝试通过 RSC 协议发送恶意请求
- **THEN** 请求 SHALL 被安全处理，不触发远程代码执行

#### Scenario: Middleware 认证保护
- **GIVEN** 系统使用 Next.js 16.0.7 或更高版本
- **WHEN** 攻击者尝试通过 `x-middleware-subrequest` header 绕过 middleware
- **THEN** 请求 SHALL 被正常处理，middleware 认证检查不被绕过

### Requirement: Partial Prerendering (PPR) 支持
系统 SHALL 通过 `cacheComponents` 配置启用 PPR 以提升首屏加载速度。

#### Scenario: cacheComponents 配置启用
- **GIVEN** `next.config.js` 配置了 `cacheComponents: true`
- **WHEN** 执行 `npm run build`
- **THEN** 系统 SHALL 对符合条件的页面启用 PPR

#### Scenario: PPR 页面静态 shell 预渲染
- **GIVEN** 页面使用 `use cache` 指令缓存静态数据
- **AND** 动态内容被 `<Suspense>` 包裹
- **WHEN** 执行 `npm run build`
- **THEN** 系统 SHALL 将页面的静态部分预渲染为 HTML shell

#### Scenario: PPR 页面动态内容流式传输
- **GIVEN** PPR 页面包含 `<Suspense>` 包裹的动态组件
- **WHEN** 用户请求该页面
- **THEN** 系统 SHALL 立即返回静态 shell
- **AND** 动态内容 SHALL 通过流式传输逐步填充

#### Scenario: use cache 指令缓存数据
- **GIVEN** 组件或函数使用 `'use cache'` 指令
- **WHEN** 执行数据获取
- **THEN** 结果 SHALL 被缓存并包含在预渲染输出中

#### Scenario: cacheLife 缓存生命周期控制
- **GIVEN** 使用 `cacheLife('hours')` 指定缓存时间
- **WHEN** 缓存时间过期
- **THEN** 系统 SHALL 重新获取数据并更新缓存

#### Scenario: cacheTag 按需重新验证
- **GIVEN** 使用 `cacheTag('faq-list')` 标记缓存
- **WHEN** 调用 `revalidateTag('faq-list')`
- **THEN** 系统 SHALL 使该标签关联的所有缓存失效

## REMOVED Requirements

### Requirement: 客户端路由缓存配置
**Reason**: Next.js 16 移除了 `experimental.staleTimes` 配置，使用 `cacheLife` 和 `cacheTag` 替代。
**Migration**: 使用 `use cache` 指令配合 `cacheLife()` 控制缓存行为。

### Requirement: Turbopack 开发模式支持
**Reason**: Next.js 16 默认启用 Turbopack，无需单独配置。
**Migration**: 移除 `dev:turbo` 脚本，`npm run dev` 默认使用 Turbopack。

## ADDED Requirements

### Requirement: React 19 兼容性
系统 SHALL 使用 React 19.2+ 并确保所有组件兼容。

#### Scenario: React 19 组件渲染
- **GIVEN** 系统使用 React 19.2+
- **WHEN** 渲染任意页面
- **THEN** 所有组件 SHALL 正常渲染，无 deprecation warnings

### Requirement: 异步 API 使用
系统 SHALL 正确使用 Next.js 16 的异步 Dynamic APIs。

#### Scenario: cookies() 异步调用
- **GIVEN** Server Component 需要访问 cookies
- **WHEN** 调用 `cookies()` 函数
- **THEN** 系统 SHALL 使用 `await cookies()` 获取 cookie store

#### Scenario: headers() 异步调用
- **GIVEN** Server Component 需要访问 headers
- **WHEN** 调用 `headers()` 函数
- **THEN** 系统 SHALL 使用 `await headers()` 获取 headers

#### Scenario: params Promise 处理
- **GIVEN** Server Component 接收 params prop
- **WHEN** 访问动态路由参数
- **THEN** 系统 SHALL 使用 `await params` 解析参数值

#### Scenario: searchParams Promise 处理
- **GIVEN** Server Component 接收 searchParams prop（如 `src/app/auth/error/page.tsx`）
- **WHEN** 访问 URL 查询参数
- **THEN** 系统 SHALL 使用 `await searchParams` 解析参数值

### Requirement: PPR 测试页面选择
系统 SHALL 在以下页面优先启用 PPR 进行优化：

#### Scenario: Customer Dashboard PPR 启用
- **GIVEN** Dashboard `/customer/dashboard` 启用 PPR
- **WHEN** 用户访问 Dashboard
- **THEN** 页面布局和静态组件 SHALL 立即显示
- **AND** 统计数据和动态卡片 SHALL 通过 Suspense 流式加载

#### Scenario: FAQ 列表页 PPR 启用
- **GIVEN** FAQ 列表页 `/customer/faq` 启用 PPR
- **WHEN** 用户访问 FAQ 页面
- **THEN** 页面布局和分类列表 SHALL 立即显示
- **AND** 搜索结果等动态内容 SHALL 通过 Suspense 流式加载

### Requirement: Middleware 重命名为 Proxy
系统 SHALL 将 `middleware.ts` 重命名为 `proxy.ts`，并更新导出函数名。

#### Scenario: Proxy 文件迁移
- **GIVEN** 系统使用 Next.js 16
- **WHEN** 执行路由保护
- **THEN** 系统 SHALL 使用 `proxy.ts` 文件和 `proxy` 导出函数

---

## 受影响文件清单

### 异步 API 迁移

| 文件 | API | 当前状态 | 迁移需求 |
|------|-----|----------|----------|
| `src/i18n.ts` | `cookies()` | ✅ 已 await | 无需修改 |
| `src/lib/utils/cookies.ts` | `cookies()` | ✅ 已 await | 无需修改 |
| `src/app/auth/error/page.tsx` | `searchParams` | ⚠️ 同步访问 | **需迁移为 Promise** |
| `src/app/unauthorized/page.tsx` | `auth()` | ✅ 已 await | 无需修改 |
| `src/app/customer/dashboard/page.tsx` | `getTranslations()` | ✅ 已 await | 无需修改 |
| `src/app/layout.tsx` | `auth()`, `getLocale()`, `getMessages()` | ✅ 已 await | 无需修改 |
| `src/app/auth/layout.tsx` | `getTranslations()` | ✅ 已 await | 无需修改 |

### 动态路由页面（Client Component，无需迁移）

所有 `[id]/page.tsx` 页面均为 Client Component，使用 `useParams()` hook：
- `src/app/admin/tickets/[id]/page.tsx`
- `src/app/customer/conversations/[id]/page.tsx`
- `src/app/customer/faq/[id]/page.tsx`
- `src/app/customer/my-tickets/[id]/page.tsx`
- `src/app/staff/conversations/[id]/page.tsx`
- `src/app/staff/tickets/[id]/page.tsx`

### 配置文件

| 文件 | 变更 |
|------|------|
| `next.config.js` | 移除 `experimental.staleTimes`，添加 `cacheComponents: true` |
| `package.json` | 升级依赖版本，可选移除 `dev:turbo` 脚本 |
| `src/middleware.ts` | 重命名为 `src/proxy.ts`，导出函数改为 `proxy` |

---

## PPR 候选页面分析

### 当前 Server Component 页面

| 页面 | 类型 | PPR 适用性 | 说明 |
|------|------|------------|------|
| `/customer/dashboard` | Server | ✅ **推荐** | 静态布局 + 动态翻译，已有 `experimental_ppr` 注释 |
| `/auth/error` | Server | ❌ 不适用 | 简单错误页面，无动态数据 |
| `/unauthorized` | Server | ❌ 不适用 | 简单错误页面，仅读取 session |

### 当前 Client Component 页面（需重构才能启用 PPR）

| 页面 | PPR 潜力 | 重构建议 |
|------|----------|----------|
| `/customer/faq` | ✅ **高** | 分类列表可静态化，搜索结果动态流式传输 |
| `/` (首页) | ⚠️ 中 | 当前完全是 Client Component，需要拆分 |
| `/admin/dashboard` | ⚠️ 中 | 统计数据动态，但布局可静态化 |
| `/staff/dashboard` | ⚠️ 中 | 同上 |

### PPR 实施优先级

1. **Phase 1**：`/customer/dashboard` - 已是 Server Component，改动最小
2. **Phase 2**：`/customer/faq` - 需要重构为 Server + Client 混合
3. **Phase 3**：首页和其他 Dashboard - 需要较大重构

---

## 依赖版本

| 依赖 | 当前版本 | 目标版本 | 兼容性 |
|------|----------|----------|--------|
| `next` | `14.2.25` | `16.0.7` | - |
| `react` | `^18.2.0` | `^19.2.0` | - |
| `react-dom` | `^18.2.0` | `^19.2.0` | - |
| `next-intl` | `4.4.0` | `4.5.7` | ✅ 支持 Next.js 16 + React 19 |
| `next-auth` | `5.0.0-beta.30` | `5.0.0-beta.30` | ✅ 支持 Next.js 16 + React 19 |
| `@types/react` | `^18.2.0` | React 19 类型 | - |
| `@types/react-dom` | `^18.2.0` | React 19 类型 | - |
| `eslint-config-next` | `^14.2.33` | `16.0.7` | - |
