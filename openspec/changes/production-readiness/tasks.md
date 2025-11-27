# Production Readiness - Tasks

## Phase 1: 安全加固 (P0 - 上线阻塞)

### 1.1 开发端点保护
- [ ] 在 `/api/dev/auto-login/route.ts` 添加环境检查，生产环境返回 404
- [ ] 审计其他 `/api/dev/*` 端点

### 1.2 Mock 认证隔离
- [ ] 添加 `NEXT_PUBLIC_ENABLE_MOCK_AUTH=true` 环境变量控制
- [ ] 登录页面根据此变量显示/隐藏测试账户登录
- [ ] mock-auth.ts 在生产模式下返回认证失败

### 1.3 中间件路由保护
- [ ] 在 `src/middleware.ts` 添加受保护路由列表
- [ ] 生产环境下 `/admin/*`、`/staff/*` 路由需要有效 session
- [ ] 无效 session 重定向到登录页

### 1.4 API 安全
- [ ] 所有 `/api/admin/*` 端点验证 admin 角色
- [ ] 所有 `/api/staff/*` 端点验证 staff/admin 角色
- [ ] 返回统一的 401/403 错误格式

## Phase 2: 环境配置 (P0)

### 2.1 环境变量验证
- [ ] 创建 `src/lib/env.ts` 统一管理环境变量
- [ ] 启动时验证必需变量：`ZAMMAD_URL`, `ZAMMAD_API_TOKEN`, `DATABASE_URL`
- [ ] 缺少必需变量时抛出明确错误

### 2.2 配置文件完善
- [ ] 更新 `.env.example` 包含所有变量及说明
- [ ] 创建 `.env.production.example` 示例

## Phase 3: 健康检查与监控 (P1)

### 3.1 健康检查端点
- [ ] 创建 `GET /api/health` 返回服务状态
- [ ] 检查 Zammad 连接状态
- [ ] 检查数据库连接状态

### 3.2 日志优化
- [ ] 生产环境过滤 `console.log` 调试信息
- [ ] API 请求添加追踪 ID
- [ ] 敏感信息（token、password）脱敏

## Phase 4: 部署准备 (P1)

### 4.1 构建验证
- [ ] `npm run build` 无错误无警告
- [ ] `npm run type-check` 通过
- [ ] `npm run lint` 通过

### 4.2 文档
- [ ] 创建 `docs/DEPLOYMENT.md` 部署指南
- [ ] 说明环境变量配置
- [ ] 说明 Zammad 对接配置

## 验收标准

- [ ] 生产环境下 `/api/dev/auto-login` 返回 404
- [ ] 生产环境下测试账户无法登录
- [ ] 健康检查端点可用
- [ ] 构建过程无错误
