# Fix NextAuth Integration Gaps

## 背景

在 production-readiness 中完成 NextAuth.js v5 集成后，代码审查发现若干遗漏和潜在问题需要修复。

## 问题清单

### 1. `/unauthorized` 页面缺失 (P0 - 严重)

**现状**：
- `src/middleware.ts:81,94` 将无权限用户重定向到 `/unauthorized`
- 但该路由页面不存在

**影响**：
- 用户访问无权限路由时会看到 404 错误，而非友好提示
- 用户体验差，无法理解为何被拒绝

**方案**：
- 创建 `src/app/unauthorized/page.tsx` 显示友好的无权限提示
- 复用 `auth.accessDenied` 的 i18n 翻译

### 2. Zustand Store 虚假会话数据 (P2 - 低优先级)

**现状**：
- `src/components/providers/session-provider.tsx:55-60` 同步 NextAuth session 到 Zustand store 时使用硬编码的 token 值
- `access_token: "nextauth-session"` 和 `refresh_token: "nextauth-refresh"` 是虚假值

**影响**：
- 如有代码依赖这些字段会得到无效数据
- 目前未发现实际使用这些字段的代码，风险低

**方案**：
- 暂不修改，添加注释说明这些字段仅用于类型兼容
- 后续如需真实 token 再重构 store 类型

### 3. 公共路由定义重复 (P2 - 低优先级)

**现状**：
- `src/middleware.ts:31-40` 和 `src/auth.ts:215-225` 各自定义了公共路由列表
- 两处列表略有差异（`/auth/error` 仅在 middleware 中）

**影响**：
- 维护成本增加，可能导致不一致
- 目前功能正常，仅影响可维护性

**方案**：
- 暂不处理，待下次重构时提取为共享常量

### 4. 登录页面重复重定向逻辑 (P3 - 建议)

**现状**：
- `src/app/auth/login/page.tsx` 有两个 useEffect 处理已登录用户重定向
- 逻辑有部分重叠

**影响**：
- 代码可读性降低
- 功能正常，仅影响代码质量

**方案**：
- 可选优化，合并为单个 useEffect

## 范围

本次修复所有发现的问题：
1. P0: 创建 `/unauthorized` 页面
2. P2: 修复 Zustand Store 虚假会话数据
3. P2: 统一公共路由定义
4. P3: 优化登录页面重定向逻辑

## 验收标准

- [ ] `/unauthorized` 页面存在且显示友好提示
- [ ] 页面支持多语言
- [ ] 页面提供返回按钮
- [ ] Zustand Store 使用真实 session.expires 或移除虚假字段
- [ ] 公共路由列表提取为共享常量
- [ ] 登录页面重定向逻辑合并为单个 useEffect
- [ ] TypeScript 类型检查通过
- [ ] 生产构建无错误
