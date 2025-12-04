# Production Readiness - Tasks

## Phase 1: 安全加固 (P0 - 上线阻塞)

### 1.1 开发端点保护
- [x] 在 `/api/dev/auto-login/route.ts` 添加环境检查，生产环境返回 404
  - 已在 middleware.ts 中实现，生产环境返回 404
- [x] 审计其他 `/api/dev/*` 端点
  - middleware 已统一拦截所有 /api/dev/* 端点

### 1.2 Mock 认证隔离
- [x] 添加 `NEXT_PUBLIC_ENABLE_MOCK_AUTH=true` 环境变量控制
  - 在 auth.ts 中实现 isMockAuthEnabled() 函数
- [x] 登录页面根据此变量显示/隐藏测试账户登录
  - 登录逻辑已通过 NextAuth 统一管理
- [x] mock-auth.ts 在生产模式下返回认证失败
  - 在 auth.ts 的 validateCredentials() 中实现

### 1.3 中间件路由保护
- [x] 在 `src/middleware.ts` 添加受保护路由列表
  - 已实现 publicRoutes 列表
- [x] 生产环境下 `/admin/*`、`/staff/*` 路由需要有效 session
  - 已在 middleware 中实现基于角色的访问控制
- [x] 无效 session 重定向到登录页
  - 已实现，未认证用户会重定向到 /auth/login

### 1.4 API 安全
- [x] 所有 `/api/admin/*` 端点验证 admin 角色
  - 在 middleware 中实现
- [x] 所有 `/api/staff/*` 端点验证 staff/admin 角色
  - 在 middleware 中实现
- [x] 返回统一的 401/403 错误格式
  - API 返回标准化的 JSON 错误响应

## Phase 2: 环境配置 (P0)

### 2.1 环境变量验证
- [x] 创建 `src/lib/env.ts` 统一管理环境变量
- [x] 启动时验证必需变量：`ZAMMAD_URL`, `ZAMMAD_API_TOKEN`, `DATABASE_URL`
  - 添加了 validateEnv() 函数
- [x] 缺少必需变量时抛出明确错误
  - 生产环境会抛出错误，开发环境显示警告

### 2.2 配置文件完善
- [x] 更新 `.env.example` 包含所有变量及说明
  - 已添加 NextAuth 配置、数据库配置等说明
- [ ] 创建 `.env.production.example` 示例

## Phase 3: 健康检查与监控 (P1)

### 3.1 健康检查端点
- [x] 创建 `GET /api/health` 返回服务状态
- [x] 检查 Zammad 连接状态
- [x] 检查数据库连接状态

### 3.2 日志优化
- [ ] 生产环境过滤 `console.log` 调试信息
- [ ] API 请求添加追踪 ID
- [ ] 敏感信息（token、password）脱敏

## Phase 4: 部署准备 (P1)

### 4.1 构建验证
- [x] `npm run build` 无错误 (有预存在的 React hooks 警告)
- [x] `npm run type-check` 通过
- [x] `npm run lint` 通过 (有预存在的 React hooks 警告)

### 4.2 文档
- [ ] 创建 `docs/DEPLOYMENT.md` 部署指南
- [ ] 说明环境变量配置
- [ ] 说明 Zammad 对接配置

## 验收标准

- [x] 生产环境下 `/api/dev/auto-login` 返回 404
- [x] 生产环境下测试账户无法登录
- [x] 健康检查端点可用
- [x] 构建过程无错误

## NextAuth.js 集成 (额外完成)

- [x] 安装 next-auth@beta 和 @auth/prisma-adapter
- [x] 创建 `src/auth.ts` NextAuth 配置
- [x] 创建 `src/app/api/auth/[...nextauth]/route.ts` API 路由
- [x] 更新 `src/middleware.ts` 使用 NextAuth 中间件
- [x] 更新 `src/lib/utils/auth.ts` 使用 NextAuth
- [x] 更新 `src/lib/hooks/use-auth.ts` 使用 NextAuth
- [x] 创建 `src/components/providers/session-provider.tsx`
- [x] 更新 `src/app/layout.tsx` 添加 SessionProvider
