# 变更：升级 Next.js 至 14.2.x 并应用性能优化

## 原因
1. **安全漏洞修复**：当前版本 `^14.0.0` 受 CVE-2025-29927（Middleware 认证绕过）影响，攻击者可通过 `x-middleware-subrequest` header 绕过所有 middleware 安全检查
2. **性能提升**：14.2.x 版本包含多项构建和运行时优化
3. **内存优化**：修复了大型应用构建时的 OOM 问题
4. **PPR 测试**：在部分页面启用 Partial Prerendering，提升首屏加载速度

## 变更内容

### 安全修复
- 升级 `next` 至 `14.2.25`（修复 CVE-2025-29927）
- 升级 `eslint-config-next` 至 `14.2.25`

### 性能优化配置
- **staleTimes**（实验性）：配置客户端路由缓存失效时间，加快页面切换
- **optimizePackageImports**：优化 barrel file 导入（`lucide-react`、`date-fns` 已默认优化）
- **Turbopack**（可选）：开发模式下可启用 `--turbo` 获得更快的 HMR
- **PPR**（实验性）：在选定页面启用 Partial Prerendering，静态 shell 立即返回，动态内容流式传输

### PPR 测试页面
- `/` - 首页（静态布局 + 动态用户信息）
- `/customer/faq` - FAQ 列表页（静态分类 + 动态搜索）
- `/customer/dashboard` - Dashboard（静态布局 + 动态统计）

### 构建优化
- Tree-shaking 改进：Server/Client Components 边界的未使用导出自动移除
- CSS chunking 优化：按导入顺序分块，避免样式冲突
- 构建内存优化：从 2.2GB 降至 ~190MB

## 影响
- 受影响的规范：infrastructure（新增）
- 受影响的代码：
  - `package.json` - 依赖版本
  - `next.config.js` - 新增性能配置（staleTimes, ppr）
  - `src/middleware.ts` - 无需修改，升级后自动修复漏洞
  - `src/app/page.tsx` - 添加 PPR 支持
  - `src/app/customer/faq/page.tsx` - 添加 PPR 支持
  - `src/app/customer/dashboard/page.tsx` - 添加 PPR 支持
- **非破坏性变更**：14.0 → 14.2 为小版本升级，API 兼容

## 迁移注意事项

### CSS 导入顺序
14.2 改变了 CSS chunking 逻辑，按导入顺序决定样式优先级。建议：
- 使用 CSS Modules 而非全局样式
- 每个 CSS Module 只在一个 JS/TS 文件中导入

### 潜在问题
- 字体加载：部分用户报告 14.2 初版有字体问题，14.2.25 已修复
- Turbopack：仍为 RC 状态，生产构建暂不支持
- PPR：实验性功能，需要正确划分 Suspense 边界，动态内容必须在 Suspense 内
