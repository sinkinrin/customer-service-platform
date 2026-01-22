# 认证系统概览（中文）

> 该文档是 `docs/AUTHENTICATION.md` 的中文概览版，描述当前实现的真实行为（以代码为准）。

**最后更新**：2026-01-22

---

## 总体设计

认证由 NextAuth v5（JWT session）实现，登录采用多策略：

1. **Zammad 认证优先**：当配置了 `ZAMMAD_URL` 与 `ZAMMAD_API_TOKEN` 时，先尝试用用户邮箱/密码到 Zammad 验证
2. **Mock 回退**：
   - 开发环境：默认启用（`NODE_ENV !== "production"`）
   - 生产环境：默认关闭，可用 `NEXT_PUBLIC_ENABLE_MOCK_AUTH=true` 显式开启
3. **生产环境 Env 账号回退**：当 mock 关闭且配置了 `AUTH_DEFAULT_USER_*`，允许单个受控账号登录（便于应急/运维）

关键实现：`src/auth.ts`（`validateCredentials` / `authenticateWithZammad` / `getProductionUserFromEnv`）

---

## Session 字段（核心）

`Session.user` 中包含（见 `src/auth.ts` 的类型扩展）：

- `role`: `customer | staff | admin`
- `region`: 业务区域（可选）
- `zammad_id`: Zammad 用户 ID（可选）
- `group_ids`: Zammad group id 列表（坐席/管理员常用）

---

## 角色与区域的来源

- 角色：由 Zammad `role_ids` 映射得到（管理员/坐席/客户）
- 区域：
  - 客户：从 Zammad `note` 解析 `Region: <region>`
  - 坐席/管理员：从 Zammad `group_ids`（含权限）反推 region（通常取 `full` 权限 group）

实现位置：`src/auth.ts` + `src/lib/constants/regions.ts`

---

## 路由保护（高层规则）

- 页面路由：未登录重定向到 `/auth/login`
- API 路由：未登录返回 401 JSON
- 角色限制：
  - `/admin/*`：仅 `admin`
  - `/staff/*`：`staff` 或 `admin`
  - `/customer/*`：登录即可

实现位置：

- `middleware.ts`
- `src/auth.ts` 中 `authorized({ auth, request })`

---

## 关键环境变量（摘要）

- `AUTH_SECRET`（生产必需；也兼容 `NEXTAUTH_SECRET`）
- `ZAMMAD_URL` / `ZAMMAD_API_TOKEN`
- `NEXT_PUBLIC_ENABLE_MOCK_AUTH`
- `AUTH_DEFAULT_USER_EMAIL` / `AUTH_DEFAULT_USER_PASSWORD` / `AUTH_DEFAULT_USER_ROLE` / `AUTH_DEFAULT_USER_REGION`

