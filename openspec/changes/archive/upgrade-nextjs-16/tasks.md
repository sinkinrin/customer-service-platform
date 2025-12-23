# 任务清单：Next.js 16 升级与 PPR 优化

## 0. 前置准备
- [ ] 0.1 备份当前 `package.json` 和 `package-lock.json`
- [ ] 0.2 确认 Node.js 版本 >= 20.9
- [ ] 0.3 确认 TypeScript 版本 >= 5.1.0
- [ ] 0.4 运行 `npx fix-react2shell-next` 检查当前安全状态

## 1. 依赖兼容性检查
- [ ] 1.1 检查 `next-intl@4.4.0` 与 Next.js 16 / React 19 兼容性
- [ ] 1.2 检查 `next-auth@5.0.0-beta.30` 与 Next.js 16 兼容性
- [ ] 1.3 检查 `@radix-ui/*` 组件与 React 19 兼容性
- [ ] 1.4 检查 `framer-motion@12.x` 与 React 19 兼容性
- [ ] 1.5 检查 `sonner@2.x` 与 React 19 兼容性
- [ ] 1.6 记录需要升级的依赖及目标版本

## 2. 依赖升级
- [ ] 2.1 升级 `next` 至 `16.0.7`
- [ ] 2.2 升级 `react` 至 `^19.2.0`
- [ ] 2.3 升级 `react-dom` 至 `^19.2.0`
- [ ] 2.4 升级 `@types/react` 至 React 19 类型
- [ ] 2.5 升级 `@types/react-dom` 至 React 19 类型
- [ ] 2.6 升级 `eslint-config-next` 至 `16.0.7`
- [ ] 2.7 升级 `next-intl` 至 `4.5.7`（支持 Next.js 16 + React 19）
- [ ] 2.8 `next-auth@5.0.0-beta.30` 已支持 Next.js 16，无需升级
- [ ] 2.9 运行 `npm install` 更新 lock 文件
- [ ] 2.10 删除 `node_modules` 和 `.next` 后重新安装

## 3. 异步 API 迁移
- [ ] 3.1 运行 codemod：`npx @next/codemod@latest migrate-to-async-dynamic-apis .`
- [ ] 3.2 检查 `src/i18n.ts` - 确认 `cookies()` 已正确 await
- [ ] 3.3 检查 `src/lib/utils/cookies.ts` - 确认 `cookies()` 已正确 await
- [ ] 3.4 检查所有 Server Component 中的 `params` 和 `searchParams` 使用
- [ ] 3.5 迁移 `src/app/auth/error/page.tsx` 的 `searchParams` 为 Promise
- [ ] 3.6 运行 `npm run type-check` 确认无类型错误

## 4. 配置更新
- [ ] 4.1 更新 `next.config.js`：
  - [ ] 4.1.1 移除 `experimental.staleTimes` 配置
  - [ ] 4.1.2 移除 `experimental.ppr` 配置（如有）
  - [ ] 4.1.3 添加 `cacheComponents: true`
- [ ] 4.2 更新 `package.json` scripts：
  - [ ] 4.2.1 移除 `dev:turbo` 脚本（Turbopack 已默认启用）
  - [ ] 4.2.2 或保留作为显式选项

## 5. PPR 页面改造

### Phase 1：最小改动（已是 Server Component）
- [ ] 5.1 Customer Dashboard `/customer/dashboard`
  - [ ] 5.1.1 移除 `export const experimental_ppr = true` 注释
  - [ ] 5.1.2 识别可缓存的数据获取，添加 `use cache`
  - [ ] 5.1.3 确认动态内容在 `<Suspense>` 内
  - [ ] 5.1.4 测试静态 shell + 动态流式传输

### Phase 2：需要重构（当前是 Client Component）
- [ ] 5.2 FAQ 列表页 `/customer/faq`
  - [ ] 5.2.1 重构为 Server Component + Client Component 混合
  - [ ] 5.2.2 分类列表静态化，添加 `use cache`
  - [ ] 5.2.3 搜索结果用 `<Suspense>` 包裹动态流式传输

### Phase 3：可选（需要较大重构）
- [ ] 5.3 首页 `/`
  - [ ] 5.3.1 评估是否需要 PPR（当前完全是 Client Component）
  - [ ] 5.3.2 如需要，拆分为 Server + Client 组件
- [ ] 5.4 Admin/Staff Dashboard
  - [ ] 5.4.1 评估 PPR 收益（布局静态化 vs 统计数据动态）

## 6. Middleware 迁移为 Proxy
- [ ] 6.1 重命名 `src/middleware.ts` 为 `src/proxy.ts`
- [ ] 6.2 将导出函数从 `middleware` 改为 `proxy`
- [ ] 6.3 更新 `next.config.js` 中的相关配置（如 `skipMiddlewareUrlNormalize` 改为 `skipProxyUrlNormalize`）

## 7. Parallel Routes 检查
- [ ] 7.1 检查项目是否使用 parallel routes
- [ ] 7.2 如有，为每个 slot 添加 `default.js` 文件

## 8. 构建验证
- [ ] 8.1 运行 `npm run build`
- [ ] 8.2 检查构建输出，确认 PPR 页面标记
- [ ] 8.3 检查是否有 deprecation warnings
- [ ] 8.4 检查构建时间和内存占用

## 9. 功能测试
- [ ] 9.1 启动开发服务器 `npm run dev`
- [ ] 9.2 测试认证流程：
  - [ ] 9.2.1 登录/登出
  - [ ] 9.2.2 Admin 路由保护
  - [ ] 9.2.3 Staff 路由保护
  - [ ] 9.2.4 Customer 路由保护
- [ ] 9.3 测试国际化：
  - [ ] 9.3.1 语言切换
  - [ ] 9.3.2 翻译显示
- [ ] 9.4 测试核心功能：
  - [ ] 9.4.1 Ticket 创建/查看/更新
  - [ ] 9.4.2 FAQ 浏览/搜索
  - [ ] 9.4.3 Conversation 功能
- [ ] 9.5 测试 PPR 页面：
  - [ ] 9.5.1 首页加载体验
  - [ ] 9.5.2 Dashboard 加载体验
  - [ ] 9.5.3 FAQ 页面加载体验

## 10. 性能验证
- [ ] 10.1 使用 Lighthouse 测试首页 LCP
- [ ] 10.2 对比升级前后的 TTFB
- [ ] 10.3 对比开发服务器启动时间
- [ ] 10.4 记录性能改善数据

## 11. 文档更新
- [ ] 11.1 更新 `docs/ARCHITECTURE.md` 中的 Next.js 版本
- [ ] 11.2 更新 README 中的技术栈信息
- [ ] 11.3 记录 PPR 使用指南（如何为新页面启用）

## 回滚计划
如遇严重问题：
1. 恢复备份的 `package.json` 和 `package-lock.json`
2. 删除 `node_modules` 和 `.next`
3. 运行 `npm install`
4. 恢复 `next.config.js` 配置

**注意**：回退到 14.2.25 不受 CVE-2025-66478 影响，可安全使用。
