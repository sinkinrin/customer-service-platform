# 变更：优化 Ticket 和 Conversation 加载性能

## 原因

Ticket 和 Conversation 是平台的核心使用场景，但当前加载速度较慢，严重影响用户体验。通过代码分析，发现以下性能瓶颈：

### 1. Zammad API 瓶颈
- 每个 ticket 需要单独获取客户信息（N+1 问题）
- 并发限制为 5 个请求，大量 ticket 时串行等待
- 无本地缓存，每次访问都请求 Zammad

### 2. 串行请求模式
- Ticket 详情页：先加载 ticket，再加载 articles（串行）
- Conversation 页：先加载会话列表，再加载消息（串行）

### 3. 无客户端缓存
- 每次进入页面都重新请求所有数据
- 页面切换后返回需要重新加载
- 没有利用 stale-while-revalidate 模式

### 4. 首屏加载过多数据
- 默认加载 50 条 ticket，实际首屏只显示 10 条
- 没有分页或虚拟滚动优化

## 变更内容

### Phase 1：快速优化（1-2 天）
- 并行请求 ticket + articles
- 首屏分页优化（默认 10 条）
- 添加 Skeleton 骨架屏

### Phase 2：缓存优化（2-3 天）
- 引入 SWR 或 React Query 进行客户端缓存
- 实现 stale-while-revalidate 模式
- 添加路由预取（hover 预加载）

### Phase 3：API 层优化（3-5 天）
- 批量获取客户信息 API
- 服务端缓存 Zammad 响应
- 优化 Zammad 请求合并

### Phase 4：高级优化（可选）
- 虚拟滚动（长列表）
- 增量加载（无限滚动）
- WebSocket 实时更新替代轮询

## 影响

### 受影响的规范
- `ticket-system` - 工单加载优化
- `conversation-system` - 对话加载优化

### 受影响的代码

**API 路由**：
- `src/app/api/tickets/route.ts` - 批量获取客户信息
- `src/app/api/tickets/[id]/route.ts` - 并行获取 ticket + articles
- `src/app/api/conversations/route.ts` - 分页优化

**Hooks**：
- `src/lib/hooks/use-ticket.ts` - 引入 SWR 缓存
- `src/lib/hooks/use-conversation.ts` - 引入 SWR 缓存

**页面组件**：
- `src/app/customer/my-tickets/page.tsx` - 分页 + 骨架屏
- `src/app/customer/my-tickets/[id]/page.tsx` - 并行加载
- `src/app/staff/tickets/page.tsx` - 分页 + 骨架屏
- `src/app/staff/tickets/[id]/page.tsx` - 并行加载
- `src/app/staff/conversations/page.tsx` - 分页 + 骨架屏
- `src/app/customer/conversations/[id]/page.tsx` - 优化消息加载

**新增依赖**：
- `swr` 或 `@tanstack/react-query` - 客户端缓存

### 非破坏性变更
- 所有优化保持 API 接口兼容
- 渐进式改进，可分阶段实施

## 预期收益

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| Ticket 列表首屏 | ~2-3s | <500ms | 80%+ |
| Ticket 详情页 | ~1-2s | <300ms | 70%+ |
| Conversation 列表 | ~1-2s | <500ms | 60%+ |
| 页面切换（缓存命中） | ~1s | <100ms | 90%+ |

## 与其他提案的关系

- **upgrade-nextjs-16**：PPR 可以优化首屏静态内容，但对动态数据加载帮助有限
- **customer-portal-optimization**：本提案聚焦性能，该提案聚焦功能修复
- **staff-portal-optimization**：同上

## 优先级

**整体优先级**：🔴 P0（紧急）

Ticket 和 Conversation 是核心业务场景，加载慢直接影响客户和客服的工作效率。
