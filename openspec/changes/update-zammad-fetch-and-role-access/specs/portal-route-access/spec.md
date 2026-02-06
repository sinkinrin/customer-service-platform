## ADDED Requirements

### Requirement: 三角色页面访问矩阵必须一致

系统 SHALL 在 `auth.ts`、`middleware.ts`、前端 `ProtectedRoute` 三层使用一致的页面访问矩阵。

#### Scenario: customer 页面访问矩阵一致
- **WHEN** 访问 `/customer/**` 页面
- **THEN** `customer`、`staff`、`admin` 三类角色 SHALL 均可访问
- **AND** 三层鉴权结果 SHALL 一致，不得出现“服务端放行、前端拦截”或相反情况

#### Scenario: staff 页面访问矩阵一致
- **WHEN** 访问 `/staff/**` 页面
- **THEN** `staff`、`admin` SHALL 可访问
- **AND** `customer` SHALL 被拒绝访问

#### Scenario: admin 页面访问矩阵一致
- **WHEN** 访问 `/admin/**` 页面
- **THEN** 仅 `admin` SHALL 可访问
- **AND** `customer` 与 `staff` SHALL 被拒绝访问

### Requirement: 页面可访问不等于业务越权

系统 SHALL 区分“页面入口访问”与“业务操作权限”；允许访问 customer 页面不得自动授予 customer 专属操作能力。

#### Scenario: Staff 访问 customer 页面但不能执行 customer 专属操作
- **GIVEN** 用户角色为 Staff
- **WHEN** 访问 `/customer/**` 页面
- **THEN** 系统 SHALL 允许页面访问
- **AND** 对 customer-only 的业务动作仍 SHALL 按后端接口权限校验拒绝越权请求

#### Scenario: Admin 访问 customer 页面但保持 admin 权限边界
- **GIVEN** 用户角色为 Admin
- **WHEN** 访问 `/customer/**` 页面
- **THEN** 系统 SHALL 允许页面访问
- **AND** 不得因页面路径切换而降低或混淆 Admin 既有权限边界

### Requirement: 未登录访问行为必须统一

系统 SHALL 对未登录用户在三类页面上的处理保持一致的重定向/错误语义。

#### Scenario: 未登录访问受保护页面
- **GIVEN** 用户未登录
- **WHEN** 访问 `/admin/**`、`/staff/**`、`/customer/**`
- **THEN** 系统 SHALL 统一重定向至登录页（页面请求）或返回 401（API 请求）
