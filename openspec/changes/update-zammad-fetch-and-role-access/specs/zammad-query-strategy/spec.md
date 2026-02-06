## ADDED Requirements

### Requirement: 工单查询必须避免全量拉取

系统 SHALL 在工单列表与搜索接口中使用分页查询作为主路径，不得以“全量拉取后本地分页”作为默认实现。

#### Scenario: Admin 获取工单列表
- **GIVEN** 用户角色为 Admin
- **WHEN** 请求 `GET /api/tickets?page=2&limit=50`
- **THEN** 系统 SHALL 仅查询本页所需候选数据
- **AND** 系统 SHALL 不调用全量工单拉取作为主路径

#### Scenario: Staff 获取工单列表并触发补页
- **GIVEN** 用户角色为 Staff
- **AND** 当前请求页经权限过滤后结果少于 `limit`
- **WHEN** 系统执行列表查询
- **THEN** 系统 SHALL 以受控方式继续查询后续页补足结果
- **AND** 系统 SHALL 在达到补页上限后停止扫描

### Requirement: 用户查询必须避免全量拉取

系统 SHALL 在用户列表和用户导出场景中使用分页查询，不得以 `searchUsers('*')` 全量结果作为默认输入。

#### Scenario: Admin 获取用户列表
- **GIVEN** 用户角色为 Admin
- **WHEN** 请求 `GET /api/admin/users?page=1&limit=20`
- **THEN** 系统 SHALL 使用分页查询获取候选用户
- **AND** 系统 SHALL 在分页后返回当前页结果

#### Scenario: Admin 导出用户
- **GIVEN** 用户角色为 Admin
- **WHEN** 请求 `GET /api/admin/users/export`
- **THEN** 系统 SHALL 以分页遍历方式构建导出结果
- **AND** 系统 SHALL 不在单次查询中拉取全量用户并常驻内存

### Requirement: 总量计算必须走计数查询

系统 SHALL 使用 Zammad 计数查询（`only_total_count=true`）获取列表总量，避免通过全量数据长度推导总数。

#### Scenario: 工单总量返回
- **WHEN** 客户端请求工单列表
- **THEN** 系统 SHALL 返回基于计数查询的 `total` 值
- **AND** 该过程 SHALL 不依赖全量工单结果

#### Scenario: 用户总量返回
- **WHEN** 客户端请求用户列表
- **THEN** 系统 SHALL 返回基于计数查询的 `total` 值
- **AND** 该过程 SHALL 不依赖全量用户结果

### Requirement: region-auth 票单可见性保持不变

系统 SHALL 保留 `region-auth` 在票单可见性中的最终裁决角色，查询优化不得改变既有可见性边界。

#### Scenario: Staff 跨区域票单不可见
- **GIVEN** 用户角色为 Staff
- **AND** 目标工单不在其允许区域或不满足既有权限规则
- **WHEN** 用户请求工单列表或搜索
- **THEN** 系统 SHALL 在最终返回前过滤该工单

#### Scenario: Admin 全局可见
- **GIVEN** 用户角色为 Admin
- **WHEN** 用户请求工单列表或搜索
- **THEN** 系统 SHALL 保持 Admin 的全局可见性
