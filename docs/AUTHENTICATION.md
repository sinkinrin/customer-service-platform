# 认证系统

> 当前认证、Session 与路由保护规则。

**最后更新**：2026-04-20
**NextAuth 版本**：`5.0.0-beta.30`

---

## 总体设计

认证由 NextAuth.js v5 实现，登录方式是 **Credentials + 多策略校验**。

当前顺序如下：

1. 优先尝试 Zammad 认证
2. 若启用了 mock auth，则回退到 mock 用户
3. 若 mock auth 关闭，则可回退到 env 中定义的单个应急账号

实现位置：`src/auth.ts`

---

## 当前 Session 事实

`src/auth.ts` 中的当前 session 配置为：

- `strategy: "jwt"`
- `maxAge = 1 day`
- `updateAge = 12 hours`
- `trustHost = true`
- 仅生产环境启用 secure cookies
- 开发环境启用 debug

这已经覆盖旧文档里“7 天 session”或“默认不安全 cookie”的说法。

---

## 登录流程

### Zammad 优先

当 `ZAMMAD_URL` 和 `ZAMMAD_API_TOKEN` 已配置时，`validateCredentials()` 会先调用 `authenticateWithZammad()`：

- 用用户邮箱/密码去 Zammad 验证
- 从 Zammad 角色映射出平台角色
- 从 Zammad 用户资料推断 region
- 组装成平台 session user 结构

### Mock 回退

如果启用了 mock auth，则会从 `src/lib/mock-auth.ts` 中查找测试用户和密码。

### Env 单用户回退

若 mock auth 未启用，代码还可以读取以下变量作为单账号 fallback：

- `AUTH_DEFAULT_USER_EMAIL`
- `AUTH_DEFAULT_USER_PASSWORD`
- `AUTH_DEFAULT_USER_ROLE`
- `AUTH_DEFAULT_USER_NAME`
- `AUTH_DEFAULT_USER_REGION`

这个路径更像应急 / 开发兜底，而不是正式生产身份模型。

---

## 角色与区域

### 角色

平台角色只有三种：

- `customer`
- `staff`
- `admin`

它们由 Zammad `role_ids` 映射得到。

### 区域

当前 region 注入逻辑：

- **Customer**：从 Zammad `note` 中解析 `Region: <region>`
- **Staff / Admin**：从 Zammad `group_ids` 反推，通常取有 `full` 权限的 group

相关文件：

- `src/auth.ts`
- `src/lib/constants/regions.ts`

---

## Session.user 字段

当前 session callback 会把这些字段放入 `session.user`：

- `id`
- `email`
- `role`
- `full_name`
- `avatar_url`
- `phone`
- `language`
- `region`
- `zammad_id`
- `group_ids`

服务端 API 常通过 `src/lib/utils/auth.ts` 把它转换成统一的 `AuthUser` 结构。

---

## 登录限流

当前 credentials 登录带有限流逻辑：

- 会基于规范化后的邮箱构造 rate-limit key
- 通过 `loginLimiter` 检查是否允许继续尝试
- 超限时抛出 `RATE_LIMIT_EXCEEDED`

所以认证文档不能只写“校验用户名密码”，还要承认当前存在登录限流。

---

## 路由保护

### 主执行层

`middleware.ts` 是主要保护层。

高层行为：

- public routes 直接放行
- 未登录访问页面时，重定向到 `/auth/login`
- 未登录访问 API 时，返回 `401` JSON
- 登录后再做角色限制

### 补充防线

`src/auth.ts` 中的 `authorized` 回调会再按共享 route 常量做一次校验。

也就是说，现在不是“只有 middleware”，而是双层保护。

---

## 高层路由规则

- `/admin/*` → 仅 `admin`
- `/staff/*` → `staff` 或 `admin`
- `/customer/*` → 任意已登录用户
- 受保护的 `/api/*` → 默认要求登录，除非该 route 被定义为 public

共享路由规则来源：`src/lib/constants/routes`

---

## 服务端认证工具

`src/lib/utils/auth.ts` 提供当前常用的服务端辅助：

- `getSession()`
- `getCurrentUser()`
- `requireAuth()`
- `requireRole()`
- `getUserRole()`
- `isAdmin()`
- `isStaff()`

写新的 API route 时，通常应该从这里进入，而不是自己手搓 session 判断。

---

## 工单权限不是只靠登录

很多工单 API 除了 `requireAuth()` / `requireRole()` 外，还会再走：

- `src/lib/utils/permission.ts`
- `src/lib/utils/region-auth.ts`

当前核心规则：

- customer 只能访问自己的 ticket
- staff 可访问分配给自己的 ticket，或自己 region / group 内的 ticket
- staff 不能访问未分配 ticket
- admin 拥有全量访问权限

---

## Mock Auth 说明

Mock 用户定义在 `src/lib/mock-auth.ts`，包括：

- customer / staff / admin 固定测试用户
- 分 region 的测试用户
- 固定测试密码

它适合本地开发与 E2E 测试，但不应被写成生产认证模型。

---

## 关键环境变量

### 核心认证

```env
AUTH_SECRET=<required secret>
NEXTAUTH_URL=http://localhost:3010
```

### Zammad 登录

```env
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=<admin token>
```

### Mock Auth

```env
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true
```

### Env Fallback User

```env
AUTH_DEFAULT_USER_EMAIL=user@example.com
AUTH_DEFAULT_USER_PASSWORD=strong-password
AUTH_DEFAULT_USER_ROLE=staff
AUTH_DEFAULT_USER_NAME="Support Agent"
AUTH_DEFAULT_USER_REGION=asia-pacific
```

这些变量的读取与规范化在 `src/lib/env.ts`。

---

## 运维注意点

- 配了 Zammad 时，会先尝试 Zammad 登录
- 开启 mock auth 时，失败的 Zammad 登录仍可能回退到 mock 用户
- 如果没有任何可用认证路径，可能出现 `AUTH_CONFIG_MISSING`
- 反向代理部署依赖 `trustHost = true`
- `.env.local` 变更遵循常规进程环境变量行为，必要时要重启

---

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md)
- [API-REFERENCE.md](./API-REFERENCE.md)
