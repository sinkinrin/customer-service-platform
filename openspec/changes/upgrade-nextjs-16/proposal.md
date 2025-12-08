# 变更：升级 Next.js 至 16.x 并启用 PPR (Partial Prerendering)

## 原因

1. **安全漏洞修复**：CVE-2025-66478（CVSS 10.0）影响 Next.js 15.x/16.x 的 RSC 协议，可导致远程代码执行。当前 14.2.25 不受影响，但升级到 16 后必须使用 16.0.7+
2. **PPR 正式支持**：Next.js 16 将 PPR 从实验性功能升级为通过 `cacheComponents` 配置的稳定功能，可显著提升首屏加载速度
3. **Turbopack 默认启用**：开发和构建都默认使用 Turbopack，大幅提升编译速度
4. **React 19.2 新特性**：View Transitions、React Compiler 支持等
5. **性能优化**：路由去重、增量预取等底层优化

## 变更内容

### **BREAKING** 依赖升级
- `next`: `14.2.25` → `16.0.7+`（最低安全版本）
- `react` / `react-dom`: `^18.2.0` → `^19.2.0`
- `@types/react` / `@types/react-dom`: 升级至 React 19 类型
- Node.js: 需要 `20.9+`（当前项目已满足）
- TypeScript: 需要 `5.1.0+`（当前 `^5.3.0` 已满足）

### **BREAKING** 异步 API 迁移
Next.js 16 中以下 API 变为异步，需要 `await`：
- `cookies()` - 已在 `src/i18n.ts` 正确使用
- `headers()` - 需检查使用位置
- `params` - 页面/布局的 params prop 变为 Promise
- `searchParams` - 页面的 searchParams prop 变为 Promise

**受影响文件**：
- `src/i18n.ts` - ✅ 已正确使用 `await cookies()`
- `src/lib/utils/cookies.ts` - ✅ 已正确使用 `await cookies()`
- `src/app/auth/error/page.tsx` - ⚠️ 需迁移 `searchParams` 为 Promise
- 动态路由页面使用 `useParams()` 客户端 hook，**无需迁移**

### PPR 配置变更
- **移除** `experimental.ppr = 'incremental'`
- **移除** 页面中的 `export const experimental_ppr = true`
- **新增** `cacheComponents: true` 配置
- **使用** `use cache` 指令显式缓存数据获取
- **使用** `cacheLife()` 和 `cacheTag()` 控制缓存行为

### Turbopack 配置
- 默认启用，无需 `--turbo` 标志
- 如有自定义 webpack 配置，需要迁移或使用 `--turbopack` 忽略

### next-intl 兼容性
- 需验证 `next-intl@4.4.0` 与 Next.js 16 的兼容性
- 可能需要升级到支持 React 19 的版本

## 影响

- **受影响的规范**：`infrastructure`（修改现有）
- **受影响的代码**：
  - `package.json` - 依赖版本
  - `next.config.js` - PPR 配置从 `experimental.ppr` 改为 `cacheComponents`
  - `src/i18n.ts` - 可能需要适配 next-intl 新版本
  - `src/lib/utils/cookies.ts` - 确认异步 API 使用
  - `src/app/customer/dashboard/page.tsx` - 移除 `experimental_ppr`，使用 `use cache`
  - 所有使用 `params`/`searchParams` 的 Server Component 页面
- **BREAKING CHANGE**：14.x → 16.x 为大版本升级，存在破坏性变更

## 迁移注意事项

### 异步 API 迁移
使用官方 codemod 自动迁移：
```bash
npx @next/codemod@latest migrate-to-async-dynamic-apis .
```

### PPR 迁移
1. 移除所有 `export const experimental_ppr = true`
2. 在 `next.config.js` 启用 `cacheComponents: true`
3. 对需要缓存的数据获取添加 `use cache` 指令
4. 动态内容必须在 `<Suspense>` 内

### Parallel Routes
检查是否有 parallel routes，如有需要添加 `default.js` 文件。

### 回滚策略
如遇严重问题，可回退到 14.2.25（不受 CVE-2025-66478 影响）。

## 验收标准

- [ ] 安全：使用 Next.js 16.0.7+，修复 CVE-2025-66478
- [ ] 构建：`npm run build` 成功
- [ ] 开发：`npm run dev` 正常启动
- [ ] PPR：启用 `cacheComponents`，关键页面实现静态 shell + 动态流式传输
- [ ] 认证：Middleware 和 NextAuth 正常工作
- [ ] 国际化：next-intl 正常工作
- [ ] 性能：首页 LCP 有明显改善
