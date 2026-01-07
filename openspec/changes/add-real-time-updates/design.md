# 设计文档：添加工单实时更新系统 (v2.0)

> **方案**：Webhook + 智能轮询
> **更新日期**：2025-12-29
> **原方案**：SSE（已放弃，跨境网络不稳定）

## 上下文

基于2025-12-26用户反馈，当前系统缺乏实时更新机制：
- Staff无法及时知道新消息到达
- 未读工单无法快速识别
- 状态变化需要手动刷新

### 网络环境约束
- **服务器**：美东弗吉尼亚
- **用户**：中国深圳
- **问题**：SSE 长连接在跨境网络下频繁断开

### 利益相关者
- **技术支持（Staff）** - 主要受益者，需要及时接收通知
- **客户（Customer）** - 间接受益，staff响应更快
- **管理员（Admin）** - 需要监控工单状态

## 目标 / 非目标

### 目标
- ✅ 工单有新消息时，staff 收到 toast 通知
- ✅ 未读工单在列表中高亮显示
- ✅ 跨境网络下稳定工作
- ✅ 通知可配置（开启/关闭）

### 非目标
- ❌ 毫秒级实时（接受几秒延迟）
- ❌ 双向实时聊天
- ❌ 离线消息队列
- ❌ 移动端推送通知

## 架构设计

### 1. 技术选型对比

| 方案 | 实时性 | 跨境稳定性 | 复杂度 | 决定 |
|------|--------|-----------|--------|------|
| SSE | ⭐⭐⭐ | ❌ 易断连 | 中 | ❌ 放弃 |
| WebSocket | ⭐⭐⭐ | ❌ 易断连 | 高 | ❌ 放弃 |
| 纯轮询 | ⭐ | ✅ 稳定 | 低 | 🟡 备选 |
| **Webhook+轮询** | ⭐⭐ | ✅ 稳定 | 中 | ✅ 采用 |

**决定**：使用 Webhook + 智能轮询，牺牲部分实时性换取稳定性。

### 2. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     Zammad Server                        │
│  工单变化 → Trigger → Webhook POST                       │
└────────────────────────┬────────────────────────────────┘
                         ↓ HTTP POST
┌────────────────────────┴────────────────────────────────┐
│              /api/webhooks/zammad                        │
│  验证签名 → 解析事件 → 写入 TicketUpdate 表              │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌────────────────────────┴────────────────────────────────┐
│              数据库 (SQLite/PostgreSQL)                  │
│  TicketUpdate: { ticketId, event, data, createdAt }     │
└────────────────────────┬────────────────────────────────┘
                         ↑ 轮询 (30s/5s)
┌────────────────────────┴────────────────────────────────┐
│              前端 (Browser)                              │
│  useTicketUpdates() → 检测更新 → Toast + 高亮            │
└─────────────────────────────────────────────────────────┘
```

### 3. 数据模型

#### TicketUpdate 表

```prisma
model TicketUpdate {
  id        String   @id @default(cuid())
  ticketId  Int
  event     String   // 'article_created' | 'status_changed' | 'assigned'
  data      String?  // JSON: { articleId, newState, assignedTo, senderEmail }
  createdAt DateTime @default(now())
  
  @@index([ticketId])
  @@index([createdAt])
}
```

#### 事件类型

```typescript
type TicketUpdateEvent = 
  | 'article_created'   // 新消息
  | 'status_changed'    // 状态变化
  | 'assigned'          // 分配变化
  | 'created'           // 新工单

interface TicketUpdate {
  id: string
  ticketId: number
  event: TicketUpdateEvent
  data?: {
    articleId?: number
    newState?: string
    assignedTo?: string
    senderEmail?: string
  }
  createdAt: string
}
```

### 4. Webhook 处理

#### 接收和解析

```typescript
// src/app/api/webhooks/zammad/route.ts
export async function POST(request: NextRequest) {
  const payload = await request.json()
  
  // 判断事件类型
  let event: TicketUpdateEvent
  if (payload.article) {
    event = 'article_created'
  } else if (payload.ticket.state_id !== previousState) {
    event = 'status_changed'
  } else if (payload.ticket.owner_id !== previousOwner) {
    event = 'assigned'
  }
  
  // 写入数据库
  await prisma.ticketUpdate.create({
    data: {
      ticketId: payload.ticket.id,
      event,
      data: JSON.stringify({
        articleId: payload.article?.id,
        senderEmail: payload.article?.from,
      })
    }
  })
}
```

### 5. 智能轮询设计

#### 轮询策略

```typescript
// src/lib/hooks/use-ticket-updates.ts

const INTERVALS = {
  DEFAULT: 30000,      // 默认 30 秒
  FAST: 5000,          // 有更新后 5 秒
  ACTIVE: 15000,       // 用户活跃时 15 秒
  FAST_DURATION: 120000 // 快速模式持续 2 分钟
}

function useTicketUpdates({ onUpdate }) {
  const [lastSync, setLastSync] = useState(Date.now())
  const [interval, setInterval] = useState(INTERVALS.DEFAULT)
  
  // 页面可见性检测
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // 页面不可见，暂停轮询
        clearInterval(pollTimer)
      } else {
        // 页面可见，恢复轮询
        startPolling()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
  }, [])
  
  // 轮询逻辑
  const poll = async () => {
    const res = await fetch(`/api/tickets/updates?since=${lastSync}`)
    const { updates, serverTime } = await res.json()
    
    if (updates.length > 0) {
      onUpdate(updates)
      setInterval(INTERVALS.FAST)  // 切换到快速模式
      setTimeout(() => setInterval(INTERVALS.DEFAULT), INTERVALS.FAST_DURATION)
    }
    
    setLastSync(serverTime)
  }
}
```

### 6. 未读状态管理

```typescript
// src/lib/stores/unread-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UnreadStore {
  unreadTickets: number[]
  unreadCounts: Record<number, number>
  markAsUnread: (ticketId: number) => void
  markAsRead: (ticketId: number) => void
  incrementCount: (ticketId: number) => void
  clearAll: () => void
  getTotalUnread: () => number
}

export const useUnreadStore = create<UnreadStore>()(
  persist(
    (set, get) => ({
      unreadTickets: [],
      unreadCounts: {},
      
      markAsUnread: (ticketId) => set((state) => ({
        unreadTickets: state.unreadTickets.includes(ticketId) 
          ? state.unreadTickets 
          : [...state.unreadTickets, ticketId]
      })),
      
      markAsRead: (ticketId) => set((state) => ({
        unreadTickets: state.unreadTickets.filter(id => id !== ticketId),
        unreadCounts: { ...state.unreadCounts, [ticketId]: 0 }
      })),
      
      incrementCount: (ticketId) => set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [ticketId]: (state.unreadCounts[ticketId] || 0) + 1
        }
      })),
      
      clearAll: () => set({ unreadTickets: [], unreadCounts: {} }),
      
      getTotalUnread: () => get().unreadTickets.length
    }),
    { name: 'ticket-unread-store' }
  )
)
```

### 7. UI 组件设计

#### 7.1 工单列表未读高亮

```tsx
// src/components/ticket/ticket-list.tsx
const { unreadTickets, unreadCounts } = useUnreadStore()
const isUnread = unreadTickets.includes(ticket.id)
const count = unreadCounts[ticket.id] || 0

<Card className={cn(
  "hover:shadow-md transition-shadow",
  isUnread && "border-l-4 border-l-blue-500 bg-blue-50/50"
)}>
  <CardTitle className={cn(isUnread && "font-bold")}>
    {ticket.title}
    {count > 0 && <Badge className="ml-2 bg-red-500">{count} new</Badge>}
  </CardTitle>
</Card>
```

#### 7.2 Toast 通知

```tsx
// 收到更新时
updates.forEach(update => {
  if (update.event === 'article_created') {
    toast.info(`New reply on #${update.ticketId}`, {
      action: {
        label: 'View',
        onClick: () => router.push(`/staff/tickets/${update.ticketId}`)
      }
    })
  }
})
```

## 性能考虑

### 轮询优化
- **智能间隔**：默认 30s，有更新后 5s，持续 2 分钟
- **页面可见性**：不可见时暂停轮询，节省资源
- **批量处理**：合并短时间内的多条通知

### 数据库优化
- **索引**：`ticketId` 和 `createdAt` 建立索引
- **定期清理**：7 天后自动删除旧记录
- **查询限制**：每次最多返回 100 条更新

### 内存优化
- 未读状态仅在客户端 localStorage 存储
- Zustand persist 自动管理

## 安全考虑

1. **Webhook 签名验证**：使用 HMAC-SHA256 验证 Zammad 请求
2. **权限过滤**：Staff 只能看到分配给自己的工单更新
3. **限流**：轮询 API 每分钟最多 30 次请求
4. **数据清理**：定期删除过期数据，防止信息泄露

## 监控指标

| 指标 | 说明 |
|------|------|
| `webhook_received_total` | Webhook 接收总数 |
| `webhook_processed_total` | Webhook 处理成功数 |
| `updates_query_duration_ms` | 更新查询耗时 |
| `unread_tickets_total` | 当前未读工单总数 |

## 参考资料

- [Zammad Webhook 文档](https://admin-docs.zammad.org/en/latest/manage/webhook.html)
- [Zammad Trigger 文档](https://admin-docs.zammad.org/en/latest/manage/trigger.html)
- [Zustand Persist](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)
- [SWR Revalidation](https://swr.vercel.app/docs/revalidation)
