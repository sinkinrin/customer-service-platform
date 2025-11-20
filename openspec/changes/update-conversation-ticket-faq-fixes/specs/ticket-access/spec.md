## ADDED Requirements
### Requirement: 工单区域与归属访问控制
系统 SHALL 在工单详情与文章读写路径上执行区域与归属校验，防止越权访问。

#### Scenario: staff 跨区域访问被拒绝
- **WHEN** staff 请求不属于其区域的工单详情或文章列表/新增
- **THEN** 系统 SHALL 返回权限错误（403）且不暴露工单任何字段

#### Scenario: customer 仅能访问自己的工单
- **WHEN** customer 请求他人创建的工单详情或文章
- **THEN** 系统 SHALL 返回 404/403 并不返回工单内容

#### Scenario: admin 可访问所有区域
- **WHEN** admin 请求任意区域工单详情或文章
- **THEN** 系统 SHALL 返回工单内容且不受区域限制
