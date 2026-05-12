## ADDED Requirements

### Requirement: AI 对话默认新建
系统 SHALL 在客户进入 AI 对话入口时默认创建一个新的 AI 会话，并避免为了首屏进入预加载旧会话列表。

#### Scenario: 客户进入 AI 对话入口
- **WHEN** 客户打开 `/customer/conversations`
- **THEN** 系统 SHALL 创建新的 AI 会话
- **AND** 系统 SHALL 跳转到新会话详情页
- **AND** 系统 SHALL NOT 在跳转前请求历史会话列表
- **AND** 系统 SHALL NOT 在新会话可输入前请求历史会话列表或历史消息

#### Scenario: 未登录客户进入 AI 对话入口
- **GIVEN** 当前请求没有认证用户
- **WHEN** 用户打开 `/customer/conversations`
- **THEN** 系统 SHALL NOT 创建 AI 会话
- **AND** 系统 SHALL 返回未授权或跳转到登录流程

### Requirement: 旧 active 会话可靠关闭
系统 SHALL 在创建新的 AI 会话时，以认证用户 ID 为归属主键关闭该用户已有的 active AI 会话，避免多个旧 active 会话残留。

#### Scenario: 客户已有 active AI 会话
- **GIVEN** 认证用户 ID 为 `user-1`
- **AND** `user-1` 存在一个或多个 active AI 会话
- **WHEN** 系统为该客户创建新的 AI 会话
- **THEN** 系统 SHALL 将 `user-1` 既有 active AI 会话全部更新为 closed
- **AND** 系统 SHALL 创建一个新的 active AI 会话

#### Scenario: 其他客户 active 会话不受影响
- **GIVEN** 认证用户 ID 为 `user-1`
- **AND** `user-2` 存在 active AI 会话
- **WHEN** 系统为 `user-1` 创建新的 AI 会话
- **THEN** 系统 SHALL NOT 关闭 `user-2` 的 active AI 会话

#### Scenario: 旧会话关闭失败
- **WHEN** 旧 active 会话关闭或新会话创建任一步失败
- **THEN** 系统 MUST NOT 留下部分完成的新旧状态
- **AND** 系统 SHALL 返回创建失败结果

#### Scenario: 并发创建 AI 会话
- **GIVEN** 同一认证用户同时触发两个创建 AI 会话请求
- **WHEN** 两个请求都完成
- **THEN** 该用户最终 SHALL 只有一个 active AI 会话
- **AND** 其他已存在或并发产生的该用户 AI 会话 SHALL 为 closed

### Requirement: 历史对话按需加载
系统 SHALL 提供历史对话入口，并仅在客户主动打开历史记录时加载旧会话列表。

#### Scenario: 客户打开新会话页面
- **WHEN** 客户通过 `/customer/conversations/{id}?new=1` 进入新 AI 会话详情页
- **THEN** 系统 SHALL 显示空的新对话
- **AND** 系统 SHALL NOT 自动加载旧会话消息
- **AND** `new=1` SHALL NOT 跳过服务端会话归属校验
- **AND** `new=1` SHALL 仅在 `{id}` 匹配本次刚创建的会话时生效一次
- **AND** 系统 SHALL 在该标记生效后移除或忽略该标记

#### Scenario: 旧会话 URL 带有 new 标记
- **GIVEN** 客户打开的会话不是本次刚创建的会话
- **WHEN** URL 包含 `?new=1`
- **THEN** 系统 SHALL 按普通旧会话加载消息
- **AND** 系统 SHALL NOT 因该参数展示空的新对话

#### Scenario: 客户打开历史记录
- **WHEN** 客户打开历史记录入口
- **THEN** 系统 SHALL 请求该客户最近 20 条历史 AI 会话
- **AND** 系统 SHALL 展示可选择的历史会话
- **AND** 系统 SHALL 提供加载更多历史会话的操作

#### Scenario: 历史记录加载中
- **WHEN** 客户打开历史记录且没有可展示缓存
- **THEN** 系统 SHALL 展示历史记录加载状态
- **AND** 系统 SHALL 保持当前 AI 输入区可用或明确禁用原因

#### Scenario: 历史记录为空
- **GIVEN** 客户没有可展示的历史 AI 会话
- **WHEN** 客户打开历史记录
- **THEN** 系统 SHALL 展示空状态
- **AND** 系统 SHALL 保留开始新对话的主路径

#### Scenario: 历史记录加载失败
- **WHEN** 历史 AI 会话列表请求失败
- **THEN** 系统 SHALL 展示错误状态
- **AND** 系统 SHALL 提供重试操作

#### Scenario: 移动端打开历史记录
- **WHEN** 客户在移动端打开历史记录
- **THEN** 系统 SHALL 使用抽屉或全屏面板展示历史记录
- **AND** 系统 SHALL NOT 让历史面板与输入区产生不可操作的重叠

#### Scenario: 未登录用户打开历史记录
- **GIVEN** 当前请求没有认证用户
- **WHEN** 用户打开历史记录入口
- **THEN** 系统 SHALL NOT 返回历史 AI 会话列表
- **AND** 系统 SHALL 返回未授权或跳转到登录流程

#### Scenario: 未登录用户访问历史消息
- **GIVEN** 当前请求没有认证用户
- **WHEN** 用户请求某个 AI 会话的消息
- **THEN** 系统 SHALL NOT 返回该会话消息
- **AND** 系统 SHALL 返回未授权或跳转到登录流程

#### Scenario: 客户打开其他用户历史会话
- **GIVEN** 认证用户 ID 为 `user-1`
- **AND** 历史会话属于 `user-2`
- **WHEN** `user-1` 尝试打开该历史会话或该会话消息
- **THEN** 系统 SHALL 拒绝访问

### Requirement: 历史列表缓存
系统 SHALL 按认证用户 ID 在客户端缓存客户历史 AI 会话列表，并在缓存命中时先展示缓存再刷新服务端数据。

#### Scenario: 历史列表存在缓存
- **GIVEN** 客户本地已有历史会话列表缓存
- **WHEN** 客户打开历史记录
- **THEN** 系统 SHALL 先展示缓存列表
- **AND** 系统 SHALL 后台请求最新列表并更新缓存

#### Scenario: 历史列表缓存超过容量
- **GIVEN** 客户历史会话列表缓存超过 50 条
- **WHEN** 系统写入缓存
- **THEN** 系统 SHALL 只保留最近 50 条历史会话摘要

#### Scenario: 持久化缓存超过字节容量
- **GIVEN** 客户端持久化缓存序列化后超过 2 MB
- **WHEN** 系统写入历史缓存
- **THEN** 系统 SHALL 优先淘汰最久未使用的消息缓存
- **AND** 如仍超过容量，系统 SHALL 淘汰最久未使用的历史列表缓存

#### Scenario: 浏览器拒绝缓存写入
- **WHEN** 浏览器因 quota 限制拒绝缓存写入
- **THEN** 系统 SHALL 清理最久未使用的历史缓存
- **AND** 系统 SHALL 保持当前 AI 对话发送和接收能力可用

#### Scenario: 历史列表缓存过期
- **GIVEN** 客户历史会话列表缓存写入时间超过 24 小时
- **WHEN** 客户打开历史记录
- **THEN** 系统 SHALL NOT 将该缓存作为可用列表展示
- **AND** 系统 SHALL 请求服务端历史会话列表

#### Scenario: 历史列表无缓存
- **GIVEN** 客户本地没有历史会话列表缓存
- **WHEN** 客户打开历史记录
- **THEN** 系统 SHALL 显示加载状态
- **AND** 系统 SHALL 请求服务端历史会话列表

#### Scenario: 切换账号后打开历史记录
- **GIVEN** 浏览器中存在 `user-1` 的历史会话列表缓存
- **WHEN** 当前认证用户变为 `user-2`
- **THEN** 系统 SHALL NOT 展示 `user-1` 的历史会话列表缓存
- **AND** 系统 SHALL 使用 `user-2` 的缓存 key 读取或请求历史会话列表

#### Scenario: 历史列表相关 mutation 后缓存刷新
- **WHEN** 客户新建、关闭或删除 AI 会话
- **THEN** 系统 SHALL 更新或失效该客户的历史会话列表缓存

#### Scenario: 重复打开历史记录
- **WHEN** 客户在历史列表请求未完成时重复打开历史记录
- **THEN** 系统 SHALL NOT 为同一 `userId + history-list + page/cursor` 发起重复并发请求

#### Scenario: 重复加载更多历史记录
- **WHEN** 客户在加载更多历史会话请求未完成时重复触发加载更多
- **THEN** 系统 SHALL NOT 为同一 `userId + history-list + page/cursor` 发起重复并发请求

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

#### Scenario: 历史消息缓存超过每会话容量
- **GIVEN** 某个会话的消息缓存超过 100 条
- **WHEN** 系统写入该会话消息缓存
- **THEN** 系统 SHALL 只保留该会话最近 100 条消息

#### Scenario: 历史消息缓存超过会话容量
- **GIVEN** 客户本地已缓存超过 10 个会话的消息
- **WHEN** 系统写入新的会话消息缓存
- **THEN** 系统 SHALL 按最近使用时间最多保留 10 个会话的消息缓存

#### Scenario: 历史消息缓存过期
- **GIVEN** 某个会话的消息缓存写入时间超过 24 小时
- **WHEN** 客户打开该旧会话
- **THEN** 系统 SHALL NOT 将该缓存作为可用消息展示
- **AND** 系统 SHALL 请求该会话最近 50 条消息

#### Scenario: 重复加载同一页历史消息
- **WHEN** 客户在某个历史消息页请求未完成时重复触发加载
- **THEN** 系统 SHALL NOT 为同一 `userId + conversationId + page/cursor` 发起重复并发请求

#### Scenario: 重复加载更早消息
- **WHEN** 客户在更早消息请求未完成时重复触发向上加载
- **THEN** 系统 SHALL NOT 为同一 `userId + conversationId + page/cursor` 发起重复并发请求

#### Scenario: 历史消息相关 mutation 后缓存刷新
- **WHEN** 客户在会话中新增消息或提交 AI 回复评分
- **THEN** 系统 SHALL 更新或失效该会话的历史消息缓存

#### Scenario: 切换账号后打开旧会话
- **GIVEN** 浏览器中存在 `user-1` 的会话消息缓存
- **WHEN** 当前认证用户变为 `user-2`
- **THEN** 系统 SHALL NOT 展示 `user-1` 的会话消息缓存
