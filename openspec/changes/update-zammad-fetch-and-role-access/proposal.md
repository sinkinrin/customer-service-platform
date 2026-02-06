# 变更：优化 Zammad 查询路径并统一三角色页面访问矩阵

## 原因

当前实现在多个核心接口中存在“全量拉取后本地过滤/分页”的模式，长期运行会带来明显风险：

1. 性能与稳定性风险
   - `GET /api/tickets` 对 Admin/Staff 使用 `getAllTickets()`，再本地做权限过滤与分页。
   - `GET /api/admin/users` 与 `/api/admin/users/export` 使用 `searchUsers('*')` 拉全量用户后再本地筛选。
   - 数据规模增长后会放大响应时延、内存占用和上游 API 压力。

2. 路由权限矩阵不一致
   - `auth.ts` 中 `/customer` 仅要求登录即可访问。
   - `middleware.ts` 未对 `/customer` 做角色限制（等同登录可访问）。
   - `src/app/customer/layout.tsx` 的 `ProtectedRoute` 仅允许 `customer`，与前两层行为不一致。

3. 票单可见性规则需保留现有业务约束
   - 既有业务要求保留 `region-auth` 对票单可见性的约束，不在本次优化中弱化。

## 调研结论（2026-02-06）

基于项目环境中的 Zammad 真实端点探测（使用现有配置）：

- `/api/v1/tickets/search` 支持 `limit` + `page`，可用于分页查询工单。
- `/api/v1/users/search` 支持 `limit` + `page`，可用于分页查询用户。
- `/api/v1/tickets/search?only_total_count=true` 和 `/api/v1/users/search?only_total_count=true` 可返回 `total_count`。
- `/api/v1/users?page=<n>&per_page=<m>` 可分页获取用户列表。

结论：可通过“分页查询 + 计数查询 + 受控补页”替代当前全量拉取路径。

## 变更内容

### 1) Zammad 查询策略改造（避免全量拉取）

- 为 tickets/users 引入分页查询与总量查询能力。
- 将 `/api/tickets`、`/api/tickets/search`、`/api/admin/users`、`/api/admin/users/export` 从“全量拉取后本地处理”改造为“分页优先 + 必要时受控补页”。
- 保持现有返回结构兼容（含 `total`），但来源改为 Zammad 计数查询。

### 2) 票单可见性保持 region-auth 约束

- 保留 `region-auth` 与权限过滤链路在票单可见性中的最终裁决作用。
- 查询优化仅缩小候选集，不改变最终可见性判定语义。

### 3) 三角色页面/权限矩阵统一

- 明确并统一 `/admin`、`/staff`、`/customer` 的角色访问矩阵：
  - `/admin/**`：仅 `admin`
  - `/staff/**`：`staff`、`admin`
  - `/customer/**`：`customer`、`staff`、`admin`
- 在 `auth.ts`、`middleware.ts`、`ProtectedRoute` 三层保持一致，避免“前后端判断不一致”。

## 影响

### 受影响的规范

- `zammad-query-strategy`（新建）
- `portal-route-access`（新建）

### 受影响的代码

- `src/lib/zammad/client.ts`
- `src/app/api/tickets/route.ts`
- `src/app/api/tickets/search/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/export/route.ts`
- `src/app/customer/layout.tsx`
- `middleware.ts`
- `src/auth.ts`
- `src/lib/constants/routes.ts`

### 风险与兼容性

- 低风险行为变化：分页策略调整后，边界页结果可能与“全量后截断”顺序不同，需通过排序规则固定输出。
- 中风险实现点：Staff 过滤后可能出现“当页不足”，需要受控补页策略避免返回量异常波动。
- 安全边界：本变更不放宽票单可见性判定，`region-auth` 仍为必经链路。

## 验收标准

1. 核心列表接口不再使用 `getAllTickets()` / `searchUsers('*')` 作为主路径。
2. 列表接口在数据规模增长时保持稳定响应，不依赖全量内存聚合。
3. `/customer/**` 在三层权限实现中对 `customer/staff/admin` 一致可访问。
4. `region-auth` 对票单可见性的最终裁决仍生效。
5. 现有角色权限边界（`/admin`、`/staff`）不被放宽。
