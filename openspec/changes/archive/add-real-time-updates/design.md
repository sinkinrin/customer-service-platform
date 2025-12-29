# 设计文档：添加工单实时更新系统

## 上下文

基于2025-12-26用户反馈，当前系统缺乏实时更新机制：
- Staff无法及时知道新消息到达
- 未读工单无法快速识别
- 状态变化需要手动刷新

### 利益相关者
- **技术支持（Staff）** - 主要受益者，需要实时接收通知
- **客户（Customer）** - 间接受益，staff响应更快
- **管理员（Admin）** - 需要实时监控工单状态

## 目标 / 非目标

### 目标
- ✅ 工单有新消息时，staff 收到实时toast通知
- ✅ 未读工单在列表中高亮显示（加粗+红点）
- ✅ 工单状态变化时，详情页自动更新
- ✅ 通知可配置（开启/关闭）

### 非目标
- ❌ 双向实时聊天（不是即时通讯应用）
- ❌ 消息已读回执（过度设计）
- ❌ 离线消息队列（复杂度高）
- ❌ 移动端推送通知（超出范围）

## 架构设计

### 1. 技术栈选择

#### SSE (Server-Sent Events)
```
优势：
✅ 单向推送，满足通知需求
✅ 基于HTTP，无需额外协议
✅ 浏览器原生支持，自动重连
✅ 比WebSocket轻量

劣势：
⚠️ 仅单向通信（但我们只需推送）
⚠️ 浏览器连接数限制（6个/域名）
```

**决定**：使用SSE，因为工单通知是单向推送场景，无需双向通信。

### 2. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     客户端（Browser）                     │
├─────────────────────────────────────────────────────────┤
│  SSE Client (EventSource)                               │
│    ↓ 接收事件                                            │
│  Unread Store (Zustand)                                 │
│    ↓ 更新状态                                            │
│  UI Components (Toast + Badge + Highlight)              │
└─────────────────────────────────────────────────────────┘
                           ↑ SSE连接
┌─────────────────────────────────────────────────────────┐
│                     服务端（Next.js）                     │
├─────────────────────────────────────────────────────────┤
│  /api/sse/tickets (SSE Endpoint)                        │
│    ↓ 维护连接池                                          │
│  Event Emitter (服务端内存)                              │
│    ↓ 发送事件                                            │
│  API Routes (触发事件)                                   │
│    - POST /api/tickets/[id]/articles → article:new       │
│    - PUT /api/tickets/[id] → ticket:update              │
│    - PUT /api/tickets/[id]/assign → ticket:assigned     │
└─────────────────────────────────────────────────────────┘
```

### 3. 事件定义

#### 事件类型

```typescript
type SSEEventType =
  | 'article:new'        // 新消息/回复
  | 'ticket:update'      // 工单状态变化
  | 'ticket:assigned'    // 工单分配变化
  | 'ticket:new'         // 新工单创建（给admin）

interface SSEEvent {
  id: string              // 事件唯一ID
  type: SSEEventType
  timestamp: number
  data: {
    ticketId: number
    ticketNumber: string
    title: string
    customerId?: string
    assignedTo?: string   // 分配给谁
    state?: string        // 新状态
    articleId?: number    // 消息ID
    sender?: string       // 发送者
  }
}
```

#### 事件过滤

```typescript
// 用户只接收与自己相关的事件
filter(event) {
  if (user.role === 'staff') {
    // staff 只接收分配给自己的工单事件
    return event.data.assignedTo === user.email
  }

  if (user.role === 'admin') {
    // admin 接收所有事件
    return true
  }

  if (user.role === 'customer') {
    // customer 只接收自己的工单事件
    return event.data.customerId === user.email
  }
}
```

### 4. 未读状态管理

#### 本地存储结构

```typescript
// Zustand Store
interface UnreadStore {
  unreadTickets: Set<number>          // 未读工单ID集合
  unreadCounts: Map<number, number>   // 每个工单的未读消息数

  // Actions
  markAsUnread: (ticketId: number) => void
  markAsRead: (ticketId: number) => void
  incrementCount: (ticketId: number) => void
  clearAll: () => void
}

// localStorage持久化
{
  "unread_tickets": [123, 456, 789],
  "unread_counts": {
    "123": 2,
    "456": 1,
    "789": 5
  }
}
```

#### 已读逻辑

```typescript
// 用户进入工单详情页时标记为已读
useEffect(() => {
  unreadStore.markAsRead(ticketId)
}, [ticketId])
```

### 5. UI组件设计

#### 5.1 工单列表未读高亮

```tsx
<Card
  className={cn(
    "hover:shadow-md transition-shadow",
    isUnread && "border-l-4 border-l-blue-500 bg-blue-50/50"
  )}
>
  <CardHeader>
    <div className="flex items-start justify-between">
      <CardTitle className={cn(isUnread && "font-bold")}>
        {ticket.title}
        {isUnread && (
          <Badge className="ml-2 bg-red-500">
            {unreadCount} new
          </Badge>
        )}
      </CardTitle>
    </div>
  </CardHeader>
</Card>
```

#### 5.2 实时Toast通知

```tsx
// 新消息到达时
toast.info(
  <div className="flex items-center gap-2">
    <MessageSquare className="h-4 w-4" />
    <div>
      <p className="font-medium">New reply on #{ticket.number}</p>
      <p className="text-sm text-muted-foreground">{sender}</p>
    </div>
  </div>,
  {
    action: {
      label: 'View',
      onClick: () => router.push(`/staff/tickets/${ticketId}`)
    }
  }
)
```

#### 5.3 详情页实时更新

```tsx
// SSE接收到article:new事件
useEffect(() => {
  const handleNewArticle = (event: SSEEvent) => {
    if (event.data.ticketId === Number(ticketId)) {
      // 追加新消息到列表
      setArticles(prev => [...prev, event.data.article])

      // 滚动到底部
      scrollToBottom()
    }
  }

  sseClient.on('article:new', handleNewArticle)
  return () => sseClient.off('article:new', handleNewArticle)
}, [ticketId])
```

### 6. SSE服务端实现

#### 6.1 SSE Endpoint

```typescript
// src/app/api/sse/tickets/route.ts
export async function GET(request: Request) {
  const user = await requireAuth()

  // 创建SSE响应
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // 发送初始连接消息
  await writer.write(
    encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
  )

  // 监听事件并推送
  const listener = (event: SSEEvent) => {
    if (shouldSendToUser(event, user)) {
      writer.write(
        encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
      )
    }
  }

  eventEmitter.on('ticket:*', listener)

  // 清理
  request.signal.addEventListener('abort', () => {
    eventEmitter.off('ticket:*', listener)
    writer.close()
  })

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

#### 6.2 事件发射器

```typescript
// src/lib/sse/event-emitter.ts
class ServerEventEmitter {
  private listeners = new Map<string, Set<Function>>()

  emit(event: SSEEvent) {
    const typeListeners = this.listeners.get(event.type) || new Set()
    typeListeners.forEach(listener => listener(event))

    // 同时触发通配符监听器
    const wildcardListeners = this.listeners.get('ticket:*') || new Set()
    wildcardListeners.forEach(listener => listener(event))
  }

  on(type: string, listener: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
  }

  off(type: string, listener: Function) {
    this.listeners.get(type)?.delete(listener)
  }
}

export const eventEmitter = new ServerEventEmitter()
```

#### 6.3 触发事件（在API路由中）

```typescript
// src/app/api/tickets/[id]/articles/route.ts
export async function POST(request: Request) {
  // ... 创建article逻辑 ...

  const article = await zammadClient.createArticle(ticketId, articleData)

  // 发射SSE事件
  eventEmitter.emit({
    id: `article_${article.id}`,
    type: 'article:new',
    timestamp: Date.now(),
    data: {
      ticketId,
      ticketNumber: ticket.number,
      title: ticket.title,
      assignedTo: ticket.owner_email,
      articleId: article.id,
      sender: user.email,
    }
  })

  return successResponse({ article })
}
```

## 性能考虑

### 连接管理
- **连接池大小**：最多1000个并发SSE连接（可配置）
- **心跳机制**：每30秒发送心跳，检测僵尸连接
- **自动清理**：超过5分钟无响应的连接自动关闭

### 内存优化
- 未读状态仅在客户端localStorage存储
- 服务端不持久化未读状态
- 事件不缓存，实时推送后丢弃

### 防抖与去重
```typescript
// 防止同一事件短时间内多次触发
const debouncedEmit = debounce((event: SSEEvent) => {
  eventEmitter.emit(event)
}, 500)
```

## 安全考虑

1. **认证**：SSE端点需要验证用户登录状态
2. **授权**：用户只能接收自己有权限的工单事件
3. **XSS防护**：事件数据需要sanitize
4. **DoS防护**：限制每个用户的SSE连接数（最多2个）

## 兼容性

| 浏览器 | SSE支持 | 备注 |
|-------|---------|------|
| Chrome | ✅ | 完全支持 |
| Firefox | ✅ | 完全支持 |
| Safari | ✅ | 完全支持 |
| Edge | ✅ | 完全支持 |
| IE 11 | ❌ | 不支持（可用polyfill） |

**降级方案**：如果浏览器不支持SSE，回退到轮询机制（每30秒）。

## 测试计划

### 单元测试
- [ ] SSE客户端连接/断开
- [ ] 事件发射器emit/on/off
- [ ] 未读状态store逻辑

### 集成测试
- [ ] 新消息触发toast通知
- [ ] 工单列表未读高亮
- [ ] 详情页实时更新

### 性能测试
- [ ] 100个并发SSE连接
- [ ] 内存泄漏检测
- [ ] 事件延迟测试（<100ms）

## 监控指标

- **SSE连接数**：当前活跃连接数
- **事件延迟**：从触发到客户端接收的时间
- **未读消息总数**：所有用户的未读工单数
- **错误率**：SSE连接失败率

## 风险与缓解

| 风险 | 严重性 | 概率 | 缓解措施 |
|-----|--------|------|---------|
| SSE连接频繁断开 | 中 | 中 | 自动重连+心跳 |
| 内存泄漏 | 高 | 低 | cleanup函数+监控 |
| 通知过载 | 低 | 中 | 防抖+去重 |
| 浏览器不兼容 | 低 | 低 | Polyfill降级 |

## 参考实现

- [Vercel Next.js SSE Example](https://github.com/vercel/next.js/tree/canary/examples/with-sse)
- [MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) (参考思路)
