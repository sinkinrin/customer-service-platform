# Production Readiness Checklist

## 背景

系统即将投入生产环境，需要完成以下准备工作以确保安全性、稳定性和可维护性。

## 核心问题

### 1. 认证系统 (P0 - 阻塞上线)

**现状**：
- `src/lib/mock-auth.ts` 使用内存中硬编码的测试账户
- Cookie 无签名验证，角色可被客户端伪造
- `/api/dev/auto-login` 开发端点在生产环境暴露安全风险

**方案**：
- 保留 mock-auth 作为开发模式
- 生产模式下禁用 mock 登录和 auto-login 端点
- 添加 `NODE_ENV` 检查，生产环境强制要求真实认证

### 2. 环境变量管理 (P0)

**现状**：
- 敏感配置（ZAMMAD_API_TOKEN）缺少运行时验证
- 缺少生产/开发环境配置分离
- `.env.example` 信息不完整

**方案**：
- 启动时验证必需环境变量
- 添加 `NEXT_PUBLIC_ENABLE_MOCK_AUTH` 控制 mock 认证

### 3. 安全加固 (P0)

**现状**：
- `src/middleware.ts` 放行所有请求，无路由保护
- 开发端点 `/api/dev/*` 无环境检查
- Zammad API Token 权限过大

**方案**：
- 中间件添加生产环境路由保护
- 开发端点添加 `NODE_ENV !== 'production'` 守卫
- 文档说明 Zammad Token 最小权限配置

### 4. 错误处理与日志 (P1)

**现状**：
- `console.log/error` 分散在代码中
- 无结构化日志格式
- 客户端错误未上报

**方案**：
- 生产环境过滤调试日志
- 添加请求追踪 ID
- 敏感信息脱敏

### 5. 构建与部署 (P1)

**现状**：
- 缺少健康检查端点
- 无 Docker 配置
- 缺少部署文档

**方案**：
- 添加 `/api/health` 端点
- 创建生产部署指南

## 不在范围内

- 替换 mock-auth 为完整的认证系统（NextAuth/Auth0）- 这是后续迭代
- 替换文件存储为数据库 - 当前 SQLite + 文件存储可满足初期需求
- 性能优化 - 单独的 openspec 处理

## 风险

- 生产环境如果未正确配置 `NODE_ENV=production`，mock 认证仍可能被滥用
- Zammad 服务不可用会导致工单功能完全失效
