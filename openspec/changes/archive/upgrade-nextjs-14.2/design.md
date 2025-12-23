# 技术设计：Next.js 14.2 升级与性能优化

## 上下文
- 当前版本：`next@^14.0.0`
- 目标版本：`next@14.2.25`
- 项目使用 App Router + Middleware 进行认证和路由保护
- 项目使用 `lucide-react`（58+ 文件）、`date-fns`、`@radix-ui/*` 等库

## 目标
- 修复 CVE-2025-29927 安全漏洞
- 提升首页加载速度
- 加快页面切换速度
- 降低构建和运行时内存消耗
- 在部分页面测试 PPR（Partial Prerendering）

## 非目标
- 升级到 Next.js 15（需要更大的迁移工作）
- 全局启用 PPR（仅在选定页面增量测试）
- 生产环境全面使用 Turbopack（尚未稳定）

## 决策

### 1. 版本选择：14.2.25
**原因**：
- 修复 CVE-2025-29927
- 包含所有 14.2.x 的性能优化
- 稳定版本，非 canary

### 2. staleTimes 配置
```javascript
experimental: {
  staleTimes: {
    dynamic: 30,  // 动态路由缓存 30 秒
    static: 180,  // 静态路由缓存 3 分钟
  },
}
```
**原因**：
- 默认 prefetch 缓存 30 秒，显式 prefetch 缓存 5 分钟
- 对于客服平台，适当延长静态内容缓存可减少重复请求
- 动态内容保持较短缓存确保数据新鲜度

### 3. 不额外配置 optimizePackageImports
**原因**：
- `lucide-react` 和 `date-fns` 已在默认优化列表中
- `@radix-ui/*` 不是 barrel file 模式，无需优化
- `framer-motion` 导入量不大，暂不需要

### 4. 开发环境启用 Turbopack（可选）
```json
"dev:turbo": "next dev -p 3010 -H 0.0.0.0 --turbo"
```
**原因**：
- 本地开发可获得 76%+ 更快的启动速度
- 96%+ 更快的 HMR
- 保留原有 `dev` 命令作为回退

### 5. PPR 增量测试（实验性）
```javascript
experimental: {
  ppr: 'incremental',  // 增量模式，仅对显式启用的页面生效
}
```

**启用 PPR 的页面**（在页面文件中导出）：
```typescript
export const experimental_ppr = true
```

**推荐测试页面**：
1. **首页 `/`** - 静态内容多，动态内容少（用户信息）
2. **FAQ 列表页 `/customer/faq`** - 文章列表可静态化，搜索动态
3. **Dashboard `/customer/dashboard`** - 布局静态，统计数据动态

**PPR 工作原理**：
- 静态部分在构建时预渲染为 HTML shell
- 动态部分用 `<Suspense>` 包裹，请求时流式传输
- 单次 HTTP 请求完成，无需多次往返

**动态边界示例**：
```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      {/* 静态内容 - 预渲染 */}
      <Header />
      <Navigation />
      
      {/* 动态内容 - 流式传输 */}
      <Suspense fallback={<StatsLoading />}>
        <DynamicStats />  {/* 需要用户数据 */}
      </Suspense>
    </div>
  )
}
```

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| CSS 样式顺序变化 | 检查全局样式导入顺序，确保 base 样式先于组件样式 |
| 字体加载问题 | 14.2.25 已修复，如有问题检查 `@fontsource/*` 导入 |
| Turbopack 不兼容 | 仅作为可选开发命令，不影响生产构建 |
| PPR 实验性功能不稳定 | 使用 `incremental` 模式，仅在 3 个页面测试，可随时回滚 |
| Suspense 边界划分不当 | 动态内容必须在 Suspense 内，否则构建报错，易于发现 |

## 验证计划

### 升级后检查清单
1. [ ] `npm run build` 成功
2. [ ] `npm run dev` 正常启动
3. [ ] Middleware 认证正常工作（测试 admin/staff/customer 路由保护）
4. [ ] 页面样式无异常
5. [ ] 字体加载正常
6. [ ] 页面切换流畅

### 性能基准测试
- 首页 LCP（Largest Contentful Paint）
- 页面切换时间
- 构建时间和内存占用

## 开放问题
- 是否需要在生产环境配置 `staleTimes`？（建议先在开发环境测试效果）
- PPR 测试页面的选择是否合适？（首页、FAQ、Dashboard）
- 是否需要为 PPR 页面添加专门的 loading 骨架屏？
