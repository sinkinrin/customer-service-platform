# Fix NextAuth Integration Gaps - Tasks

## Phase 1: 严重问题修复 (P0)

### 1.1 创建 /unauthorized 页面
- [x] 创建 `src/app/unauthorized/page.tsx`
  - 显示无权限访问提示
  - 显示用户当前角色（如已登录）
  - 提供返回上一页按钮
  - 提供返回首页/仪表板链接
- [x] 复用现有 i18n 翻译 `auth.accessDenied`
- [x] 确保页面样式与 `/auth/error` 一致

### 1.2 验证 /unauthorized 页面
- [ ] 以 customer 角色访问 /admin/* 路由，验证重定向到 /unauthorized
- [ ] 以 customer 角色访问 /staff/* 路由，验证重定向到 /unauthorized
- [ ] 页面正确显示当前角色和返回按钮

## Phase 2: Zustand Store 会话数据修复 (P2)

### 2.1 修复 session-provider.tsx
- [x] 修改 `src/components/providers/session-provider.tsx`
- [x] 使用 `session.expires` 计算真实的 `expires_at`
- [x] 移除虚假的 `access_token` 和 `refresh_token` 字段，或标记为可选
- [x] 更新 `src/lib/mock-auth.ts` 类型定义（MockSession token 字段改为可选）

### 2.2 验证 Store 数据
- [x] 检查是否有代码依赖 `useAuthStore` 的 token 字段（无依赖）
- [x] 确保修改不破坏现有功能（type-check 通过）

## Phase 3: 统一公共路由定义 (P2)

### 3.1 提取共享常量
- [x] 创建 `src/lib/constants/routes.ts`
- [x] 定义 `PUBLIC_ROUTES` 常量数组
- [x] 定义 `STATIC_ROUTES` 常量数组
- [x] 定义 `isRouteMatch` 辅助函数

### 3.2 更新引用
- [x] 更新 `src/middleware.ts` 使用共享常量
- [x] 更新 `src/auth.ts` 的 `authorized` callback 使用共享常量
- [x] 确保两处行为一致

## Phase 4: 登录页面重定向优化 (P3)

### 4.1 合并重定向逻辑
- [x] 修改 `src/app/auth/login/page.tsx`
- [x] 将两个处理已登录用户重定向的 useEffect 合并为一个
- [x] 简化重定向判断流程（优先使用 userRole，dev 环境回退 email 推断）

### 4.2 验证登录流程
- [ ] 测试 customer 登录后正确跳转到 /customer/dashboard
- [ ] 测试 staff 登录后正确跳转到 /staff/dashboard
- [ ] 测试 admin 登录后正确跳转到 /admin/dashboard
- [ ] 测试已登录用户访问 /auth/login 时的重定向

## 验收检查

- [x] `npm run type-check` 通过
- [x] `npm run build` 无错误
- [ ] `npm run lint` 无新增错误
- [ ] 手动测试角色访问控制
- [ ] 手动测试登录流程

## 实现摘要

### 新增文件
- `src/app/unauthorized/page.tsx` - 无权限页面（服务端组件）
- `src/app/unauthorized/unauthorized-content.tsx` - 无权限页面内容（客户端组件）
- `src/lib/constants/routes.ts` - 共享路由常量

### 修改文件
- `src/lib/mock-auth.ts` - MockSession 类型的 token 字段改为可选
- `src/components/providers/session-provider.tsx` - 使用真实 session.expires，移除虚假 token
- `src/middleware.ts` - 使用共享路由常量
- `src/auth.ts` - 使用共享路由常量
- `src/app/auth/login/page.tsx` - 合并两个重定向 useEffect
