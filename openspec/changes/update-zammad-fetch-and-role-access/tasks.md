## 1. Zammad Client 能力扩展

- [ ] 1.1 在 `src/lib/zammad/client.ts` 增加 tickets 分页查询封装（支持 `page`、`limit`、查询字符串）
- [ ] 1.2 在 `src/lib/zammad/client.ts` 增加 users 分页查询封装（支持 `page`、`limit`、查询字符串）
- [ ] 1.3 增加 `only_total_count=true` 的计数查询封装（tickets/users）
- [ ] 1.4 为分页查询增加统一错误处理和日志字段（query、page、limit、duration）

## 2. 工单接口改造（去全量拉取）

- [ ] 2.1 改造 `src/app/api/tickets/route.ts`：移除 Admin/Staff 主路径中的 `getAllTickets()`
- [ ] 2.2 为 Staff 增加“受控补页”策略（最多扫描 N 页以补足当前页结果）
- [ ] 2.3 保留并明确 `region-auth` / 权限过滤在最终返回前执行
- [ ] 2.4 改造 `src/app/api/tickets/search/route.ts`：使用分页搜索 + 计数查询
- [ ] 2.5 验证 `limit/page/status/customer_email` 等查询参数语义不回归

## 3. 用户接口改造（去全量拉取）

- [ ] 3.1 改造 `src/app/api/admin/users/route.ts`：移除 `searchUsers('*')` 全量拉取
- [ ] 3.2 改造 `src/app/api/admin/users/export/route.ts`：使用分页遍历导出，不一次性加载全量
- [ ] 3.3 保持 Staff 的区域约束过滤与 Admin 的全局能力不变

## 4. 三角色页面权限矩阵统一

- [ ] 4.1 统一 `auth.ts`、`middleware.ts`、`ProtectedRoute` 的角色矩阵来源
- [ ] 4.2 调整 `src/app/customer/layout.tsx` 允许 `customer/staff/admin`
- [ ] 4.3 保持 `/admin` 仅 admin、`/staff` 为 staff/admin 的既有规则
- [ ] 4.4 验证页面路由和 API 路由在未登录/越权场景返回一致（重定向或 401/403）

## 5. 测试与回归

- [ ] 5.1 增加工单列表分页策略测试（含 Staff 补页和 region-auth 最终裁决）
- [ ] 5.2 增加用户列表分页与导出测试（含 role/region 过滤）
- [ ] 5.3 增加路由矩阵一致性测试（customer/staff/admin 三角色）
- [ ] 5.4 增加性能回归基线（记录请求次数、响应时间、返回条数）

## 6. 文档与发布

- [ ] 6.1 更新相关开发文档，说明新的 Zammad 查询策略与限制
- [ ] 6.2 补充运维观察项（接口耗时、分页扫描页数、上游错误率）
- [ ] 6.3 发布后观察并确认无权限回归后归档该变更
