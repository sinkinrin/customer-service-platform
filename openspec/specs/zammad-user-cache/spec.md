# zammad-user-cache Specification

## Purpose

定义 Zammad 用户展示信息缓存的当前行为边界，用于降低列表、详情、搜索与导出场景对 Zammad 的重复用户查询压力。

## Requirements

### Requirement: Zammad 用户展示信息缓存
系统 SHALL 在进程内缓存 Zammad 用户的展示信息（姓名、邮箱），TTL 为 5 分钟，供工单列表、详情、搜索与导出复用。缓存 SHALL NOT 包含角色、组等权限相关字段。

#### Scenario: 列表请求命中缓存
- **GIVEN** 用户 ID 100 的展示信息已在 5 分钟内被缓存
- **WHEN** 工单列表请求需要用户 100 的展示信息
- **THEN** 系统 SHALL 使用缓存值
- **AND** 系统 SHALL NOT 向 Zammad 发起该用户的查询

#### Scenario: 部分未命中时仅查询缺失用户
- **GIVEN** 请求需要用户 100、101 的展示信息，仅 100 在缓存中
- **WHEN** 系统组装工单展示数据
- **THEN** 系统 SHALL 仅向 Zammad 查询用户 101
- **AND** 查询结果 SHALL 回填缓存

#### Scenario: 缓存过期后重新获取
- **GIVEN** 用户 100 的缓存条目已超过 5 分钟
- **WHEN** 请求需要该用户展示信息
- **THEN** 系统 SHALL 重新向 Zammad 查询并刷新缓存

#### Scenario: 用户查询失败不缓存失败结果
- **WHEN** 向 Zammad 查询某用户失败
- **THEN** 系统 SHALL 按现有行为跳过该用户的展示信息
- **AND** 系统 SHALL NOT 将失败结果写入缓存

### Requirement: 资料更新时缓存失效
系统 SHALL 在本平台内的用户资料更新成功后，立即失效该用户的展示信息缓存。

#### Scenario: 用户更新本人资料
- **WHEN** 用户通过 profile 接口成功更新姓名
- **THEN** 系统 SHALL 失效该用户的展示信息缓存
- **AND** 后续工单列表 SHALL 展示新姓名

#### Scenario: 管理员更新他人资料或状态
- **WHEN** 管理员通过用户管理接口成功更新某用户的资料或状态
- **THEN** 系统 SHALL 失效该用户的展示信息缓存