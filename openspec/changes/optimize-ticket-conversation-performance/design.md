# 技术设计：Ticket 和 Conversation 性能优化

## 上下文

- **当前架构**：Client Component + useEffect 数据获取
- **数据源**：Zammad API（工单）+ 本地存储（对话）
- **问题**：串行请求、无缓存、首屏数据过多

## 目标

- Ticket 列表首屏加载 < 500ms
- Ticket 详情页加载 < 300ms
- 页面切换（缓存命中）< 100ms
- 减少 Zammad API 调用次数 50%+

## 非目标

- 不改变 Zammad 集成架构
- 不引入 Redis 等外部缓存服务
- 不重构为 Server Component（保持现有架构）

## 决策

### 1. 客户端缓存：选择 SWR

**原因**：
- 轻量级（~4KB gzip）
- 内置 stale-while-revalidate
- 与 Next.js 生态集成良好
- 学习成本低

**备选**：
- `@tanstack/react-query`：功能更强但更重
- 自定义 Zustand 缓存：需要手动实现 revalidate

**使用模式**：
```typescript
// src/lib/hooks/use-ticket.ts
import useSWR from 'swr'

export function useTickets(options?: { limit?: number; status?: string }) {
  const { limit = 10, status } = options || {}
  const params = new URLSearchParams({ limit: String(limit) })
  if (status) params.append('status', status)

  return useSWR(
    `/api/tickets?${params}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,  // 30 秒内不重复请求
      keepPreviousData: true,   // 保持旧数据直到新数据到达
    }
  )
}
```

### 2. 并行请求：Promise.all

**当前**（串行）：
```typescript
useEffect(() => {
  loadTicket()      // 等待完成
  loadArticles()    // 再开始
}, [ticketId])
```

**优化后**（并行）：
```typescript
useEffect(() => {
  Promise.all([
    fetchTicketById(ticketId),
    fetchArticles(ticketId)
  ]).then(([ticket, articles]) => {
    setTicket(ticket)
    setArticles(articles)
  })
}, [ticketId])
```

### 3. 批量获取客户信息 API

**当前**：
```typescript
// 每个 ticket 单独获取客户
for (const ticket of tickets) {
  const customer = await zammadClient.getUser(ticket.customer_id)
}
```

**优化后**：
```typescript
// 一次性获取所有客户
const customerIds = [...new Set(tickets.map(t => t.customer_id))]
const customers = await zammadClient.getUsersBatch(customerIds)
```

**Zammad API**：
- `GET /api/v1/users?ids=1,2,3` - 批量获取用户

### 4. 首屏分页

**当前**：默认加载 50 条
**优化后**：默认加载 10 条，滚动加载更多

```typescript
// 首屏
const { data: tickets } = useTickets({ limit: 10 })

// 加载更多
const loadMore = () => {
  setSize(size + 1)  // SWR infinite loading
}
```

### 5. 路由预取

```typescript
// 鼠标悬停时预加载
<Link 
  href={`/tickets/${id}`}
  onMouseEnter={() => {
    // 预取 ticket 详情
    mutate(`/api/tickets/${id}`)
  }}
>
```

## 实现细节

### API 层改造

```typescript
// src/app/api/tickets/route.ts
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '10')  // 默认 10
  const includeCustomer = searchParams.get('includeCustomer') === 'true'

  let tickets = await zammadClient.getTickets({ limit })

  if (includeCustomer) {
    // 批量获取客户信息
    const customerIds = [...new Set(tickets.map(t => t.customer_id))]
    const customers = await zammadClient.getUsersBatch(customerIds)
    const customerMap = new Map(customers.map(c => [c.id, c]))
    
    tickets = tickets.map(t => ({
      ...t,
      customer: customerMap.get(t.customer_id)
    }))
  }

  return successResponse({ tickets })
}
```

### Hook 改造

```typescript
// src/lib/hooks/use-ticket.ts
import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useTickets(options?: UseTicketsOptions) {
  const { limit = 10, status } = options || {}
  
  const getKey = (pageIndex: number) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(pageIndex * limit),
      includeCustomer: 'true'
    })
    if (status) params.append('status', status)
    return `/api/tickets?${params}`
  }

  const { data, error, size, setSize, isValidating } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const tickets = data ? data.flatMap(page => page.data.tickets) : []
  const isLoading = !data && !error
  const isLoadingMore = isValidating && data && data.length === size
  const hasMore = data && data[data.length - 1]?.data.tickets.length === limit

  return {
    tickets,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore: () => setSize(size + 1),
    error
  }
}

export function useTicketDetail(ticketId: string) {
  // 并行获取 ticket 和 articles
  const { data: ticketData } = useSWR(
    ticketId ? `/api/tickets/${ticketId}` : null,
    fetcher
  )
  
  const { data: articlesData } = useSWR(
    ticketId ? `/api/tickets/${ticketId}/articles` : null,
    fetcher
  )

  return {
    ticket: ticketData?.data,
    articles: articlesData?.data || [],
    isLoading: !ticketData || !articlesData
  }
}
```

### 组件改造

```tsx
// src/app/customer/my-tickets/page.tsx
export default function MyTicketsPage() {
  const { tickets, isLoading, hasMore, loadMore, isLoadingMore } = useTickets()

  if (isLoading) {
    return <TicketListSkeleton count={5} />
  }

  return (
    <div>
      <TicketList tickets={tickets} />
      
      {hasMore && (
        <Button 
          onClick={loadMore} 
          disabled={isLoadingMore}
        >
          {isLoadingMore ? '加载中...' : '加载更多'}
        </Button>
      )}
    </div>
  )
}
```

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SWR 缓存导致数据不一致 | 中 | 设置合理的 revalidate 间隔，关键操作后手动 mutate |
| Zammad 批量 API 不支持 | 中 | 回退到并发请求，提高并发限制 |
| 无限滚动性能问题 | 低 | 限制最大加载数量，或引入虚拟滚动 |

## 验证计划

### 性能基准测试

1. 使用 Chrome DevTools 记录当前加载时间
2. 实施优化后对比
3. 使用 Lighthouse 测试 LCP、TTI

### 测试场景

- [ ] Ticket 列表首屏加载（10 条）
- [ ] Ticket 列表加载更多
- [ ] Ticket 详情页加载
- [ ] 页面切换后返回（缓存命中）
- [ ] 多标签页数据一致性
- [ ] 网络慢速模式下的体验
