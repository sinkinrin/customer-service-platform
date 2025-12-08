# 性能规范：Ticket 和 Conversation 加载优化

## ADDED Requirements

### Requirement: Ticket 列表加载性能
系统 SHALL 在 500ms 内完成 Ticket 列表首屏渲染。

#### Scenario: 首屏快速加载
- **GIVEN** 用户访问 Ticket 列表页面
- **WHEN** 页面开始加载
- **THEN** 系统 SHALL 在 500ms 内显示首批 10 条 Ticket
- **AND** 系统 SHALL 显示骨架屏直到数据加载完成

#### Scenario: 增量加载更多
- **GIVEN** 用户已查看首批 Ticket
- **WHEN** 用户点击"加载更多"或滚动到底部
- **THEN** 系统 SHALL 加载下一批 10 条 Ticket
- **AND** 已加载的 Ticket SHALL 保持显示

#### Scenario: 缓存命中快速响应
- **GIVEN** 用户已访问过 Ticket 列表
- **WHEN** 用户从其他页面返回 Ticket 列表
- **THEN** 系统 SHALL 在 100ms 内显示缓存数据
- **AND** 系统 SHALL 在后台重新验证数据

### Requirement: Ticket 详情页加载性能
系统 SHALL 在 300ms 内完成 Ticket 详情页渲染。

#### Scenario: 并行数据加载
- **GIVEN** 用户访问 Ticket 详情页
- **WHEN** 页面开始加载
- **THEN** 系统 SHALL 并行请求 Ticket 信息和 Articles
- **AND** 系统 SHALL 在 300ms 内显示完整内容

#### Scenario: 预取优化
- **GIVEN** 用户在 Ticket 列表页面
- **WHEN** 用户鼠标悬停在某个 Ticket 上
- **THEN** 系统 SHALL 预取该 Ticket 的详情数据
- **AND** 点击后 SHALL 立即显示预取的数据

### Requirement: Conversation 列表加载性能
系统 SHALL 在 500ms 内完成 Conversation 列表首屏渲染。

#### Scenario: 首屏快速加载
- **GIVEN** 用户访问 Conversation 列表页面
- **WHEN** 页面开始加载
- **THEN** 系统 SHALL 在 500ms 内显示首批 10 条 Conversation
- **AND** 系统 SHALL 显示骨架屏直到数据加载完成

### Requirement: Conversation 详情页加载性能
系统 SHALL 在 300ms 内完成 Conversation 详情页渲染。

#### Scenario: 消息列表快速加载
- **GIVEN** 用户访问 Conversation 详情页
- **WHEN** 页面开始加载
- **THEN** 系统 SHALL 在 300ms 内显示最近 50 条消息
- **AND** 历史消息 SHALL 支持向上滚动加载

### Requirement: 客户端缓存策略
系统 SHALL 使用 SWR 实现客户端数据缓存。

#### Scenario: Stale-While-Revalidate
- **GIVEN** 缓存中存在数据
- **WHEN** 用户请求该数据
- **THEN** 系统 SHALL 立即返回缓存数据
- **AND** 系统 SHALL 在后台重新获取最新数据
- **AND** 新数据到达后 SHALL 自动更新 UI

#### Scenario: 缓存去重
- **GIVEN** 30 秒内发起相同请求
- **WHEN** 第二次请求发起
- **THEN** 系统 SHALL 复用第一次请求的结果
- **AND** 不 SHALL 发起重复的网络请求

#### Scenario: 缓存失效
- **GIVEN** 用户执行了数据变更操作（创建/更新/删除）
- **WHEN** 操作成功完成
- **THEN** 系统 SHALL 立即使相关缓存失效
- **AND** 系统 SHALL 重新获取最新数据

### Requirement: API 层批量优化
系统 SHALL 支持批量获取客户信息以减少 API 调用。

#### Scenario: 批量获取用户信息
- **GIVEN** Ticket 列表包含多个不同的 customer_id
- **WHEN** 系统需要显示客户信息
- **THEN** 系统 SHALL 一次性批量获取所有客户信息
- **AND** 不 SHALL 为每个 Ticket 单独请求客户信息

#### Scenario: 服务端缓存
- **GIVEN** 系统已获取过某用户信息
- **WHEN** 5 分钟内再次需要该用户信息
- **THEN** 系统 SHALL 返回缓存的用户信息
- **AND** 不 SHALL 请求 Zammad API

---

## 性能指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| Ticket 列表 FCP | < 200ms | Chrome DevTools |
| Ticket 列表 LCP | < 500ms | Lighthouse |
| Ticket 详情 TTI | < 300ms | Chrome DevTools |
| 缓存命中响应 | < 100ms | Performance API |
| Zammad API 调用减少 | > 50% | 服务端日志 |

---

## 受影响文件

### Hooks（需要重构）
| 文件 | 变更 |
|------|------|
| `src/lib/hooks/use-ticket.ts` | 使用 SWR 重构 |
| `src/lib/hooks/use-conversation.ts` | 使用 SWR 重构 |

### API 路由（需要优化）
| 文件 | 变更 |
|------|------|
| `src/app/api/tickets/route.ts` | 批量获取客户、默认分页 10 |
| `src/app/api/tickets/search/route.ts` | 批量获取客户 |
| `src/app/api/conversations/route.ts` | 默认分页 10 |

### 页面组件（需要更新）
| 文件 | 变更 |
|------|------|
| `src/app/customer/my-tickets/page.tsx` | 使用新 hooks、骨架屏 |
| `src/app/customer/my-tickets/[id]/page.tsx` | 并行加载 |
| `src/app/staff/tickets/page.tsx` | 使用新 hooks、骨架屏 |
| `src/app/staff/tickets/[id]/page.tsx` | 并行加载 |
| `src/app/admin/tickets/[id]/page.tsx` | 并行加载 |
| `src/app/staff/conversations/page.tsx` | 使用新 hooks、骨架屏 |
| `src/app/staff/conversations/[id]/page.tsx` | 并行加载 |
| `src/app/customer/conversations/[id]/page.tsx` | 并行加载 |

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/lib/swr-config.tsx` | SWR 全局配置 |
| `src/lib/cache/memory-cache.ts` | 服务端内存缓存 |
| `src/components/ticket/ticket-list-skeleton.tsx` | 骨架屏组件 |
| `src/components/ticket/ticket-detail-skeleton.tsx` | 骨架屏组件 |
| `src/components/conversation/conversation-list-skeleton.tsx` | 骨架屏组件 |

### 依赖
| 包 | 版本 | 说明 |
|------|------|------|
| `swr` | `^2.2.0` | 客户端缓存 |
