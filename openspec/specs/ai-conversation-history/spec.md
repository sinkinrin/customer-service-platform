# ai-conversation-history Specification

## Purpose

定义客户 AI 对话的当前历史行为边界：新会话默认创建、历史列表按需加载、客户端缓存、消息持久化与流式返回协同工作。

## Requirements

### Requirement: 客户 AI 对话默认新建
系统 SHALL 在客户进入 AI 对话入口时默认创建一个新的 AI 会话，并避免为了首屏进入预加载旧会话列表。

#### Scenario: 客户进入 AI 对话入口
- **WHEN** 客户打开 `/customer/conversations`
- **THEN** 系统 SHALL 创建新的 AI 会话
- **AND** 系统 SHALL 跳转到新会话详情页
- **AND** 系统 SHALL NOT 在跳转前请求历史会话列表

#### Scenario: 未登录客户进入 AI 对话入口
- **GIVEN** 当前请求没有认证用户
- **WHEN** 用户打开 `/customer/conversations`
- **THEN** 系统 SHALL NOT 创建 AI 会话
- **AND** 系统 SHALL 返回未授权或跳转到登录流程

### Requirement: 同一客户只保留一个 active 会话
系统 SHALL 在创建新的 AI 会话时，以认证用户为归属关闭该用户已有的 active AI 会话，避免多个旧 active 会话残留。

#### Scenario: 客户已有 active AI 会话
- **GIVEN** 认证用户存在一个或多个 active AI 会话
- **WHEN** 系统为该客户创建新的 AI 会话
- **THEN** 系统 SHALL 将该客户既有 active AI 会话更新为 closed
- **AND** 系统 SHALL 创建一个新的 active AI 会话

#### Scenario: 其他客户 active 会话不受影响
- **GIVEN** 用户 A 与用户 B 都存在会话
- **WHEN** 系统为用户 A 创建新的 AI 会话
- **THEN** 系统 SHALL NOT 关闭用户 B 的 active AI 会话

### Requirement: 历史会话按需加载
系统 SHALL 提供历史对话入口，并仅在客户主动打开历史记录时加载旧会话列表。

#### Scenario: 客户打开新会话页面
- **WHEN** 客户通过 `/customer/conversations/{id}?new=1` 进入新 AI 会话详情页
- **THEN** 系统 SHALL 显示空的新对话
- **AND** 系统 SHALL NOT 自动加载旧会话消息

#### Scenario: 客户打开历史记录
- **WHEN** 客户打开历史记录入口
- **THEN** 系统 SHALL 请求该客户最近 20 条历史 AI 会话
- **AND** 系统 SHALL 展示可选择的历史会话
- **AND** 系统 SHALL 提供加载更多历史会话的操作

#### Scenario: 客户打开其他用户历史会话
- **GIVEN** 历史会话属于其他用户
- **WHEN** 当前用户尝试打开该历史会话或该会话消息
- **THEN** 系统 SHALL 拒绝访问

### Requirement: 历史列表缓存
系统 SHALL 按认证用户 ID 在客户端缓存客户历史 AI 会话列表，并在缓存命中时先展示缓存再刷新服务端数据。

#### Scenario: 历史列表存在缓存
- **GIVEN** 客户本地已有历史会话列表缓存
- **WHEN** 客户打开历史记录
- **THEN** 系统 SHALL 先展示缓存列表
- **AND** 系统 SHALL 后台请求最新列表并更新缓存

#### Scenario: 历史列表缓存过期
- **GIVEN** 客户历史会话列表缓存写入时间超过 24 小时
- **WHEN** 客户打开历史记录
- **THEN** 系统 SHALL NOT 将该缓存作为可用列表展示
- **AND** 系统 SHALL 请求服务端历史会话列表

### Requirement: 历史消息缓存
系统 SHALL 按认证用户 ID 和会话 ID 缓存历史消息，并仅在客户打开旧会话时加载该会话消息。

#### Scenario: 打开有缓存的旧会话
- **GIVEN** 客户本地已有某个旧会话的消息缓存
- **WHEN** 客户打开该旧会话
- **THEN** 系统 SHALL 先展示缓存消息
- **AND** 系统 SHALL 请求最近 50 条消息并更新缓存

#### Scenario: 打开无缓存的旧会话
- **GIVEN** 客户本地没有该旧会话的消息缓存
- **WHEN** 客户打开该旧会话
- **THEN** 系统 SHALL 显示加载状态
- **AND** 系统 SHALL 请求该会话最近 50 条消息
- **AND** 系统 SHALL 支持向上加载更早消息

### Requirement: 流式 AI 回复与持久化协同
系统 SHALL 在客户 AI 流式回复期间维持可见的临时消息，并在服务端持久化成功后把真实消息 ID 反馈给客户端。

#### Scenario: 服务端流式持久化成功
- **WHEN** `/api/ai/chat` 以 SSE 返回流式 AI 回复且服务端持久化成功
- **THEN** 系统 SHALL 追加 `persisted` 事件携带真实消息 ID
- **AND** 客户端 SHALL 用真实消息 ID 替换临时消息 ID

#### Scenario: 迁移期双写避免重复消息
- **WHEN** 服务端持久化与旧客户端补写路径短时间内同时命中同一 AI 回复
- **THEN** 系统 SHALL 通过幂等保护避免写入重复 AI 消息

#### Scenario: 流式中断但已有部分文本
- **WHEN** 上游流式请求因错误、超时或取消而提前结束
- **THEN** 系统 SHALL 保留已收到的部分文本用于持久化尝试
- **AND** 客户端 SHALL 按当前错误处理逻辑收尾

#### Scenario: 上游处理期间暂时没有回答数据
- **GIVEN** AI provider 仍在有界的 idle 等待窗口内处理请求
- **WHEN** 上游暂时没有发送回答或节点状态数据
- **THEN** 服务端 SHALL 以短于 idle timeout 的间隔发送 SSE 注释心跳，避免反向代理提前关闭连接
- **AND** 心跳 SHALL NOT 被视为回答文本、证据或持久化数据
- **AND** 心跳 SHALL NOT 重置 provider idle watchdog
- **AND** 反向代理读取超时 SHALL 大于应用 idle timeout，使应用能够先发送受控的 SSE 错误并完成部分持久化
