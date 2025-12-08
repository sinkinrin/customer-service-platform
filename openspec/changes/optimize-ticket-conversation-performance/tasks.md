# 任务清单：Ticket 和 Conversation 性能优化

## Phase 1：快速优化（1-2 天）

### 1.1 并行请求优化
- [ ] 1.1.1 修改 `src/app/customer/my-tickets/[id]/page.tsx` - 并行加载 ticket + articles
- [ ] 1.1.2 修改 `src/app/staff/tickets/[id]/page.tsx` - 并行加载 ticket + articles
- [ ] 1.1.3 修改 `src/app/admin/tickets/[id]/page.tsx` - 并行加载 ticket + articles
- [ ] 1.1.4 修改 `src/app/staff/conversations/[id]/page.tsx` - 并行加载 conversation + messages

### 1.2 首屏分页优化
- [ ] 1.2.1 修改 `src/app/api/tickets/route.ts` - 默认 limit 从 50 改为 10
- [ ] 1.2.2 修改 `src/app/api/conversations/route.ts` - 默认 limit 从 50 改为 10
- [ ] 1.2.3 修改 `src/app/customer/my-tickets/page.tsx` - 添加"加载更多"按钮
- [ ] 1.2.4 修改 `src/app/staff/tickets/page.tsx` - 添加"加载更多"按钮
- [ ] 1.2.5 修改 `src/app/staff/conversations/page.tsx` - 添加"加载更多"按钮

### 1.3 骨架屏优化
- [ ] 1.3.1 创建 `src/components/ticket/ticket-list-skeleton.tsx`
- [ ] 1.3.2 创建 `src/components/ticket/ticket-detail-skeleton.tsx`
- [ ] 1.3.3 创建 `src/components/conversation/conversation-list-skeleton.tsx`
- [ ] 1.3.4 在各页面使用骨架屏替代简单 Loading

## Phase 2：缓存优化（2-3 天）

### 2.1 引入 SWR
- [ ] 2.1.1 安装 `swr` 依赖
- [ ] 2.1.2 创建 `src/lib/swr-config.tsx` - SWR 全局配置
- [ ] 2.1.3 在 `src/app/layout.tsx` 添加 SWRConfig Provider

### 2.2 改造 Ticket Hooks
- [ ] 2.2.1 重构 `src/lib/hooks/use-ticket.ts` - 使用 SWR
- [ ] 2.2.2 实现 `useTickets()` - 列表查询 + 无限加载
- [ ] 2.2.3 实现 `useTicketDetail(id)` - 详情查询
- [ ] 2.2.4 实现 `useTicketArticles(id)` - 文章列表
- [ ] 2.2.5 更新所有使用 useTicket 的组件

### 2.3 改造 Conversation Hooks
- [ ] 2.3.1 重构 `src/lib/hooks/use-conversation.ts` - 使用 SWR
- [ ] 2.3.2 实现 `useConversations()` - 列表查询
- [ ] 2.3.3 实现 `useConversationDetail(id)` - 详情查询
- [ ] 2.3.4 实现 `useConversationMessages(id)` - 消息列表
- [ ] 2.3.5 更新所有使用 useConversation 的组件

### 2.4 路由预取
- [ ] 2.4.1 在 Ticket 列表项添加 hover 预取
- [ ] 2.4.2 在 Conversation 列表项添加 hover 预取
- [ ] 2.4.3 测试预取效果

## Phase 3：API 层优化（3-5 天）

### 3.1 批量获取客户信息
- [ ] 3.1.1 在 `src/lib/zammad/client.ts` 添加 `getUsersBatch(ids)` 方法
- [ ] 3.1.2 修改 `src/app/api/tickets/route.ts` - 使用批量获取
- [ ] 3.1.3 修改 `src/app/api/tickets/search/route.ts` - 使用批量获取
- [ ] 3.1.4 测试批量 API 性能提升

### 3.2 服务端缓存
- [ ] 3.2.1 创建 `src/lib/cache/memory-cache.ts` - 内存 LRU 缓存
- [ ] 3.2.2 为 Zammad 用户信息添加缓存（TTL: 5 分钟）
- [ ] 3.2.3 为 Zammad ticket 列表添加缓存（TTL: 30 秒）
- [ ] 3.2.4 实现缓存失效策略（ticket 更新时清除）

### 3.3 请求合并
- [ ] 3.3.1 提高 Zammad 并发限制（5 → 10）
- [ ] 3.3.2 实现请求去重（相同请求合并）
- [ ] 3.3.3 添加请求超时和重试机制

## Phase 4：高级优化（可选）

### 4.1 虚拟滚动
- [ ] 4.1.1 安装 `@tanstack/react-virtual`
- [ ] 4.1.2 为 Ticket 列表实现虚拟滚动
- [ ] 4.1.3 为 Conversation 消息列表实现虚拟滚动

### 4.2 增量加载
- [ ] 4.2.1 实现无限滚动（Intersection Observer）
- [ ] 4.2.2 添加滚动位置恢复

### 4.3 实时更新优化
- [ ] 4.3.1 评估 WebSocket 替代 SSE 轮询
- [ ] 4.3.2 实现增量更新（只推送变更）

## 验证任务

### 性能测试
- [ ] 记录优化前基准数据（Ticket 列表、详情页加载时间）
- [ ] 每个 Phase 完成后测试并记录改善
- [ ] 使用 Lighthouse 测试 LCP、TTI
- [ ] 测试慢速网络（3G）下的体验

### 功能回归测试
- [ ] Ticket 创建/查看/更新/删除
- [ ] Ticket 搜索和筛选
- [ ] Conversation 创建/发送消息
- [ ] 实时通知（SSE）正常工作
- [ ] 多标签页数据一致性

## 依赖

- `swr@^2.2.0` - 客户端缓存
- `@tanstack/react-virtual@^3.0.0` - 虚拟滚动（Phase 4）
