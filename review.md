# 代码审查报告

## 问题 1: Ticket SSE 跨区域数据泄露

### 严重程度
🔴 **高危** - 安全漏洞

### 问题描述
每个工单的创建/更新/删除事件会广播到所有连接的 SSE 客户端,无论他们的区域权限如何。登录到 `/staff/tickets` 的员工会立即收到属于其他区域的工单的 `id`、`number`、`title`、`state_id`、`priority_id` 和 `group_id` 信息,即使他们没有权限访问这些工单。

### 受影响的文件和位置

#### 1. 广播逻辑缺陷
**文件**: `src/lib/sse/ticket-broadcaster.ts` (lines 44-78)
```typescript
export function broadcastEvent(
  event: { type: string; data: any },
  targetUserIds?: string[]
) {
  // ...
  if (targetUserIds) {
    // 发送到指定用户
  } else {
    // ❌ 广播到所有连接的用户 - 没有区域过滤
    connections.forEach((controller, userId) => {
      controller.enqueue(encodedMessage)
    })
  }
}
```

**问题**: `connections` Map 只存储了 `userId` 和 `controller`,没有存储用户的角色、区域等元数据,无法进行权限过滤。

#### 2. 工单创建广播
**文件**: `src/app/api/tickets/route.ts` (lines 400-416)
```typescript
broadcastEvent({
  type: 'ticket_created',
  data: {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    state_id: ticket.state_id,
    priority_id: ticket.priority_id,
    group_id: ticket.group_id,  // ❌ 包含区域敏感信息
  },
})
// ❌ 没有指定 targetUserIds,广播到所有用户
```

#### 3. 工单更新广播
**文件**: `src/app/api/tickets/[id]/route.ts` (lines 286-301)
```typescript
broadcastEvent({
  type: 'ticket_updated',
  data: { /* 包含敏感信息 */ },
})
// ❌ 没有指定 targetUserIds
```

#### 4. 工单删除广播
**文件**: `src/app/api/tickets/[id]/route.ts` (lines 339-350)
```typescript
broadcastEvent({
  type: 'ticket_deleted',
  data: { id: ticketId },
})
// ❌ 没有指定 targetUserIds
```

### 安全影响
- **数据泄露**: Staff 用户可以看到其他区域工单的详细信息
- **隐私违规**: 违反了基于区域的访问控制策略
- **合规风险**: 可能违反数据保护法规 (GDPR, 数据本地化等)

### 修复方案

#### 方案 A: 基于区域的目标用户过滤 (推荐)

1. **增强 broadcaster 的用户元数据存储**
```typescript
// src/lib/sse/ticket-broadcaster.ts
const connections = new Map<string, {
  controller: ReadableStreamDefaultController
  role: string
  region?: string
}>()

export function addConnection(
  userId: string,
  controller: ReadableStreamDefaultController,
  role: string,
  region?: string
) {
  connections.set(userId, { controller, role, region })
}
```

2. **添加基于区域的过滤函数**
```typescript
export function broadcastEventByRegion(
  event: { type: string; data: any },
  groupId: number  // 工单的 group_id
) {
  const region = getRegionByGroupId(groupId)

  connections.forEach(({ controller, role, region: userRegion }, userId) => {
    // Admin 可以看到所有区域
    if (role === 'admin') {
      controller.enqueue(encodedMessage)
    }
    // Staff 只能看到自己区域的工单
    else if (role === 'staff' && userRegion === region) {
      controller.enqueue(encodedMessage)
    }
    // Customer 不接收 SSE 广播
  })
}
```

3. **更新所有 broadcastEvent 调用**
```typescript
// src/app/api/tickets/route.ts
broadcastEventByRegion(
  { type: 'ticket_created', data: { /* ... */ } },
  ticket.group_id
)
```

#### 方案 B: 空载荷 + 客户端重新获取 (更安全)

1. **只广播事件类型和 ID**
```typescript
broadcastEvent({
  type: 'ticket_updated',
  data: { id: ticket.id }  // ❌ 移除敏感数据
})
```

2. **客户端收到事件后主动重新获取**
```typescript
// 客户端 SSE 监听器
eventSource.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data)

  if (type === 'ticket_updated') {
    // 使用用户的认证凭据重新获取工单详情
    // API 会自动进行区域权限检查
    fetchTicketById(data.id)
  }
}
```

### 实施清单
- [ ] 更新 `ticket-broadcaster.ts` 存储用户元数据
- [ ] 在 `src/app/api/sse/tickets/route.ts` 中传递用户角色和区域
- [ ] 实现 `broadcastEventByRegion` 函数
- [ ] 更新所有 `broadcastEvent` 调用为 `broadcastEventByRegion`
- [ ] 添加单元测试验证区域过滤逻辑
- [ ] 进行安全测试:创建不同区域的工单,验证 Staff 只能收到自己区域的事件

---

## 问题 2: 客户工单搜索只过滤已加载的页面数据

### 严重程度
🟡 **中等** - 功能缺陷

### 问题描述
客户工单页面的"搜索"功能只在客户端内存中的 `tickets` 数组上进行过滤,从不调用 `/api/tickets/search` API。由于页面初始只加载 50 条工单,任何超出当前已加载页面的工单对搜索是不可见的,除非客户手动先加载所有页面。对于拥有大量历史工单的客户,这实际上无法使用,并且与 UI 承诺的"搜索工单"功能相矛盾。

### 受影响的文件和位置

#### 客户端搜索逻辑
**文件**: `src/app/customer/my-tickets/page.tsx` (lines 52-73)

```typescript
const [tickets, setTickets] = useState<Ticket[]>([])  // 只存储已加载的工单
const [searchQuery, setSearchQuery] = useState('')
const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([])

// ❌ 只在内存中过滤,不调用 API
useEffect(() => {
  if (searchQuery.trim()) {
    const filtered = tickets.filter(ticket =>
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.number.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setFilteredTickets(filtered)
  } else {
    setFilteredTickets(tickets)
  }
}, [searchQuery, tickets])

// 初始只加载 50 条
const fetchTickets = async (pageToLoad: number, append: boolean = false) => {
  const response = await fetch(`/api/tickets?query=${encodeURIComponent(user?.email || '')}&limit=50&page=${pageToLoad}`)
}
```

### 功能影响
- **搜索不完整**: 用户无法搜索所有历史工单
- **用户体验差**: 需要手动"加载更多"多次才能搜索到旧工单
- **误导性 UI**: 搜索框暗示可以搜索所有工单,但实际只搜索已加载的工单
- **扩展性差**: 对于有数百个工单的客户,这个功能几乎无法使用

### 对比: Staff 和 Admin 页面的正确实现

**Staff 页面** (`src/app/staff/tickets/page.tsx` lines 70-86) 和 **Admin 页面** (`src/app/admin/tickets/page.tsx` lines 72-88) **已经正确实现**了服务器端搜索:

```typescript
const handleSearch = async () => {
  const query = searchQuery.trim()

  if (!query) {
    await loadTickets(1, false)
    return
  }

  // ✅ 调用搜索 API
  const result = await searchTickets(query, 50, 1)
  if (result) {
    setTickets(result.tickets)
    setPage(1)
    setHasMore(result.hasMore)
    setIsSearchMode(true)
  }
}
```

### 修复方案

#### 方案 A: 使用搜索 API (推荐)

**修改**: `src/app/customer/my-tickets/page.tsx`

```typescript
// 1. 添加搜索模式状态
const [isSearchMode, setIsSearchMode] = useState(false)

// 2. 移除客户端过滤的 useEffect
// ❌ 删除 lines 63-73

// 3. 实现服务器端搜索
const handleSearch = async () => {
  const query = searchQuery.trim()

  if (!query) {
    // 清空搜索,重新加载第一页
    await fetchTickets(1, false)
    setIsSearchMode(false)
    return
  }

  setLoading(true)
  try {
    // ✅ 调用搜索 API
    const response = await fetch(
      `/api/tickets/search?query=${encodeURIComponent(query)}&limit=50&page=1`
    )

    if (!response.ok) {
      throw new Error('Failed to search tickets')
    }

    const data = await response.json()
    setTickets(data.data.tickets || [])
    setHasMore(data.data.hasMore || false)
    setPage(1)
    setIsSearchMode(true)
  } catch (error) {
    console.error('Failed to search tickets:', error)
    toast.error('搜索失败')
  } finally {
    setLoading(false)
  }
}

// 4. 更新 UI: 添加搜索按钮或实时搜索
<Input
  placeholder="搜索工单标题或编号..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }}
/>
<Button onClick={handleSearch}>
  <Search className="h-4 w-4" />
</Button>

// 5. 移除 filteredTickets,直接使用 tickets
// 将所有 filteredTickets 替换为 tickets
```

#### 方案 B: 预加载所有工单 (不推荐,仅适用于工单数量少的情况)

```typescript
// 在初始加载时获取所有工单
const fetchAllTickets = async () => {
  let allTickets: Ticket[] = []
  let currentPage = 1
  let hasMorePages = true

  while (hasMorePages) {
    const response = await fetch(`/api/tickets?query=${encodeURIComponent(user?.email || '')}&limit=100&page=${currentPage}`)
    const data = await response.json()
    allTickets = [...allTickets, ...data.data.tickets]
    hasMorePages = data.data.hasMore
    currentPage++

    // 安全限制:最多加载 1000 条
    if (allTickets.length >= 1000) break
  }

  setTickets(allTickets)
}
```

**缺点**:
- 初始加载慢
- 消耗大量内存
- 不适合工单数量多的客户

### 实施清单
- [ ] 移除客户端过滤的 `useEffect` (lines 63-73)
- [ ] 添加 `isSearchMode` 状态
- [ ] 实现 `handleSearch` 函数调用 `/api/tickets/search`
- [ ] 更新 UI 添加搜索按钮或 Enter 键触发
- [ ] 将所有 `filteredTickets` 替换为 `tickets`
- [ ] 测试搜索功能:验证可以搜索到所有历史工单
- [ ] 测试清空搜索:验证可以返回正常的分页列表
- [ ] 更新"加载更多"逻辑:在搜索模式下也支持分页

### API 验证
✅ `/api/tickets/search` API 已存在并正常工作
- 支持 `query` 参数进行全文搜索
- 支持分页 (`limit`, `page`)
- 对客户自动使用 `X-On-Behalf-Of` 进行权限控制
- 参考: `src/app/api/tickets/search/route.ts`

---

## 总结

### 优先级
1. **问题 1 (SSE 数据泄露)**: 🔴 高优先级 - 立即修复
2. **问题 2 (搜索功能缺陷)**: 🟡 中优先级 - 尽快修复

### 建议修复顺序
1. 先修复问题 1 的安全漏洞,防止数据泄露
2. 再修复问题 2 的功能缺陷,改善用户体验

### 相关文档
- 区域权限检查: `src/lib/utils/region-auth.ts`
- SSE 实现: `src/lib/sse/ticket-broadcaster.ts`
- 搜索 API: `src/app/api/tickets/search/route.ts`
