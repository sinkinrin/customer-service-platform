## 上下文

当前 tickets/users 相关接口存在“先全量拉取，再本地筛选/分页”的实现。该模式在数据增长时会导致：

- 上游 Zammad 请求量和响应体持续放大
- API 进程内存与 CPU 开销上升
- 前端分页语义依赖后端全量聚合，扩展性较差

同时，`/customer` 路由在 `auth.ts`、`middleware.ts`、`ProtectedRoute` 三层的角色判定不一致，导致行为不可预测。

## 目标 / 非目标

- 目标：
  - 将 tickets/users 主查询链路改为分页优先，移除全量拉取主路径。
  - 保持现有业务权限语义，尤其保留 `region-auth` 的票单可见性裁决。
  - 统一三角色页面权限矩阵在三层鉴权中的实现。
  - 提供可观测的查询日志与回归指标。

- 非目标：
  - 不重构整个授权架构（例如不引入新的 PolicyEngine）。
  - 不修改核心角色定义（`customer/staff/admin`）与业务流程。
  - 不在本次变更中重做前端分页组件交互。

## 决策

### 决策 1：使用 Zammad 分页/计数能力替代全量拉取

- tickets：
  - 列表优先使用分页查询（`page` + `limit/per_page`）。
  - 搜索使用 `/tickets/search` 的 `query + limit + page`。
  - 总量使用 `only_total_count=true`。
- users：
  - 列表使用 `/users` 或 `/users/search` 的分页能力。
  - 总量使用 `only_total_count=true`。

### 决策 2：Staff 场景采用“受控补页”而非全量扫描

Staff 在候选集经 `region-auth` 过滤后可能出现“当前页不足”。为保持返回条数稳定：

- 首先按请求页读取候选数据。
- 若过滤后不足 `limit`，继续读取后续页补齐。
- 使用可配置上限（例如 `maxScanPages`）避免退化为全量拉取。

### 决策 3：`region-auth` 保持最终裁决

查询优化只用于缩小候选集，最终返回前必须通过现有权限过滤链路（含 `region-auth` / permission 逻辑）。

### 决策 4：角色矩阵单一来源

将页面访问矩阵统一为单一配置源，并在以下层同时使用：

- `auth.ts` 的 `authorized`
- `middleware.ts` 的路由拦截
- `ProtectedRoute`/layout 的前端拦截

矩阵定义：

- `/admin/**`：`admin`
- `/staff/**`：`staff`、`admin`
- `/customer/**`：`customer`、`staff`、`admin`

## 风险 / 权衡

- 风险：补页上限过小会导致 Staff 页面“明明有更多可见工单但当前页不满”。
  - 缓解：记录补页命中率，按观测结果调优上限。
- 风险：计数接口失败时会影响 `total` 准确性。
  - 缓解：计数失败时降级为 `null`/估算并显式记录日志。
- 权衡：不再使用全量聚合后，某些“全局排序 + 过滤后分页”的绝对一致性会受限。
  - 缓解：固定排序字段并保证分页稳定性。

## 迁移计划

1. 先扩展 `zammadClient` 分页与计数 API（不改业务路由）。
2. 逐个替换 tickets/users 路由，保留旧路径开关用于回滚。
3. 统一角色矩阵，联调页面与 API 拦截行为。
4. 补充测试与监控后移除旧全量实现。

## 回滚策略

- 保留旧查询分支（短期 feature flag）。
- 若出现分页回归，快速切回旧路径并保留日志样本定位问题。

## 开放问题

- Staff 的补页上限默认值应设为多少（3/5/10）更合理？
- 导出接口是否需要分块流式写出以进一步降低峰值内存？
- `total` 字段在计数失败时返回策略（`null` 或最后成功值）需要前端共识。
