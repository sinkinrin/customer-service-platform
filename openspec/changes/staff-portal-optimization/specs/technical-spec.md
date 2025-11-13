# Staff Portal 优化技术规范

## 1. 系统架构

### 1.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                    Staff Portal前端                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │Dashboard │  │Tickets   │  │Convers.  │  │Knowledge│ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────┬────┘ │
│        └──────────────┴─────────────┴─────────────┘     │
│                         │                                │
│                    ┌────▼────┐                          │
│                    │API Layer│                          │
│                    └────┬────┘                          │
└─────────────────────────┼───────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ Tickets │      │  SSE    │      │ Zammad  │
   │   API   │      │ Service │      │  Client │
   └────┬────┘      └────┬────┘      └────┬────┘
        │                │                 │
        └────────────────┴─────────────────┘
                         │
                    ┌────▼────┐
                    │Database │
                    │  Store  │
                    └─────────┘
```

### 1.2 数据流
```
用户操作 → 前端组件 → API路由 → 业务逻辑 → 数据库/Zammad
                                            ↓
                     SSE推送 ← 实时事件 ← 数据变更
```

## 2. 核心Bug修复详细设计

### 2.1 Conversations页面修复

#### 问题诊断
```typescript
// 当前错误代码 (src/app/(staff)/conversations/page.tsx:108)
const filteredConversations = conversations.filter((conv) => {
  // TypeError: conversations.filter is not a function
  // 说明 conversations 不是数组
})
```

#### 根本原因分析
1. **数据获取问题**：API返回的可能不是数组
2. **类型定义缺失**：没有正确的TypeScript类型保护
3. **错误处理缺失**：没有处理异常情况

#### 修复方案

**方案A：添加数组验证（推荐）**
```typescript
'use client'

import { useConversations } from '@/lib/hooks/use-conversations'
import { Conversation } from '@/types/conversation'

export default function StaffConversationsPage() {
  const { conversations, isLoading, error } = useConversations()

  // 确保conversations是数组
  const conversationList = Array.isArray(conversations) ? conversations : []

  const filteredConversations = conversationList.filter((conv) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      conv.title?.toLowerCase().includes(query) ||
      conv.customer?.name?.toLowerCase().includes(query)
    )
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (conversationList.length === 0) return <EmptyState />

  return (
    <div>
      {/* 渲染对话列表 */}
      {filteredConversations.map(conv => (
        <ConversationItem key={conv.id} conversation={conv} />
      ))}
    </div>
  )
}
```

**方案B：修复数据获取逻辑**
```typescript
// src/lib/hooks/use-conversations.ts
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchConversations() {
      try {
        const response = await fetch('/api/staff/conversations')
        if (!response.ok) throw new Error('Failed to fetch')

        const data = await response.json()

        // 确保返回数组
        if (Array.isArray(data)) {
          setConversations(data)
        } else if (data.conversations && Array.isArray(data.conversations)) {
          setConversations(data.conversations)
        } else {
          console.error('Invalid data format:', data)
          setConversations([])
        }
      } catch (err) {
        setError(err as Error)
        setConversations([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [])

  return { conversations, isLoading, error }
}
```

#### 测试用例
```typescript
describe('StaffConversationsPage', () => {
  it('应该处理空数组', () => {
    // Mock返回空数组
    mockUseConversations.mockReturnValue({
      conversations: [],
      isLoading: false,
      error: null
    })

    const { getByText } = render(<StaffConversationsPage />)
    expect(getByText('No conversations')).toBeInTheDocument()
  })

  it('应该处理非数组响应', () => {
    // Mock返回非数组数据
    mockUseConversations.mockReturnValue({
      conversations: { data: [] } as any,
      isLoading: false,
      error: null
    })

    // 不应该崩溃
    expect(() => render(<StaffConversationsPage />)).not.toThrow()
  })

  it('应该正确过滤对话', () => {
    const mockConversations = [
      { id: '1', title: 'Test 1' },
      { id: '2', title: 'Example 2' }
    ]

    mockUseConversations.mockReturnValue({
      conversations: mockConversations,
      isLoading: false,
      error: null
    })

    const { getByPlaceholderText } = render(<StaffConversationsPage />)
    const searchInput = getByPlaceholderText('Search')

    fireEvent.change(searchInput, { target: { value: 'Test' } })

    // 应该只显示匹配的对话
    expect(screen.getByText('Test 1')).toBeInTheDocument()
    expect(screen.queryByText('Example 2')).not.toBeInTheDocument()
  })
})
```

### 2.2 Tickets路由修复

#### 问题分析
```typescript
// 当前问题：工单ID从60097截断为97
// URL: /staff/tickets/97 (404)
// 应该: /staff/tickets/60097 (200)
```

#### 根本原因
1. **字符串截取错误**：可能在某处截取了工单号
2. **ID格式不一致**：Zammad返回的ID格式与显示的不同
3. **路由参数丢失**：动态路由参数传递错误

#### 调查步骤
```typescript
// 1. 检查Zammad API返回的ID格式
console.log('Zammad ticket:', ticket.id) // 应该是60097

// 2. 检查列表渲染的ID
console.log('Rendered ticket:', ticketItem.id)

// 3. 检查点击处理
onClick={() => router.push(`/staff/tickets/${ticket.id}`)}

// 4. 检查URL参数
const params = useParams()
console.log('Route params:', params.id)
```

#### 修复方案

**修复tickets列表页面**
```typescript
// src/app/(staff)/tickets/page.tsx
'use client'

import { useRouter } from 'next/navigation'

export default function TicketsPage() {
  const router = useRouter()
  const { tickets } = useTickets()

  const handleTicketClick = (ticket: Ticket) => {
    // 确保使用完整的工单ID
    const fullTicketId = ticket.number || ticket.id
    console.log('[Tickets] Navigating to:', `/staff/tickets/${fullTicketId}`)
    router.push(`/staff/tickets/${fullTicketId}`)
  }

  return (
    <div>
      {tickets.map(ticket => (
        <TicketItem
          key={ticket.id}
          ticket={ticket}
          onClick={() => handleTicketClick(ticket)}
        />
      ))}
    </div>
  )
}
```

**修复工单详情页面**
```typescript
// src/app/(staff)/tickets/[id]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const ticketId = params.id

  console.log('[TicketDetail] Ticket ID:', ticketId)

  const { ticket, isLoading, error } = useTicket(ticketId)

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} ticketId={ticketId} />
  if (!ticket) return <NotFoundState ticketId={ticketId} />

  return (
    <div>
      <h1>工单 #{ticket.number || ticket.id}</h1>
      {/* 工单详情 */}
    </div>
  )
}
```

**验证Zammad客户端**
```typescript
// src/lib/zammad/client.ts
export async function getTicket(ticketId: string | number) {
  console.log('[Zammad] Fetching ticket:', ticketId)

  const response = await fetch(`${ZAMMAD_URL}/api/v1/tickets/${ticketId}`, {
    headers: {
      'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
      'X-On-Behalf-Of': getCurrentUserId(),
    }
  })

  if (!response.ok) {
    console.error('[Zammad] Error:', response.status, response.statusText)
    throw new Error(`Failed to fetch ticket ${ticketId}`)
  }

  const ticket = await response.json()
  console.log('[Zammad] Ticket data:', { id: ticket.id, number: ticket.number })

  return ticket
}
```

#### 测试用例
```typescript
describe('Ticket routing', () => {
  it('应该使用完整的工单ID导航', () => {
    const mockTicket = { id: 60097, number: '60097', title: 'Test' }
    const mockRouter = { push: jest.fn() }

    const { getByText } = render(<TicketsPage />)
    const ticketItem = getByText('Test')

    fireEvent.click(ticketItem)

    expect(mockRouter.push).toHaveBeenCalledWith('/staff/tickets/60097')
  })

  it('应该正确解析URL参数', async () => {
    mockUseParams.mockReturnValue({ id: '60097' })

    const { getByText } = render(<TicketDetailPage />)

    await waitFor(() => {
      expect(getByText('工单 #60097')).toBeInTheDocument()
    })
  })
})
```

### 2.3 Knowledge Base页面创建

#### 设计要求
- 集成Zammad Knowledge Base API
- 支持分类浏览
- 支持全文搜索
- 显示文章统计（浏览量、评分）
- Staff专属功能（编辑建议、质量评分）

#### 技术实现

**创建页面结构**
```typescript
// src/app/(staff)/knowledge/page.tsx
'use client'

import { useState } from 'react'
import { useKnowledgeBase } from '@/lib/hooks/use-knowledge-base'
import { KnowledgeArticleList } from '@/components/staff/knowledge-article-list'
import { KnowledgeSidebar } from '@/components/staff/knowledge-sidebar'
import { KnowledgeSearch } from '@/components/staff/knowledge-search'

export default function StaffKnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { articles, categories, isLoading } = useKnowledgeBase({
    query: searchQuery,
    categoryId: selectedCategory
  })

  return (
    <div className="flex h-screen">
      <KnowledgeSidebar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground">
              Browse and manage knowledge base articles
            </p>
          </div>

          <KnowledgeSearch
            value={searchQuery}
            onChange={setSearchQuery}
          />

          <KnowledgeArticleList
            articles={articles}
            isLoading={isLoading}
            showStaffActions
          />
        </div>
      </main>
    </div>
  )
}
```

**实现API集成**
```typescript
// src/lib/hooks/use-knowledge-base.ts
import { useEffect, useState } from 'react'
import { KnowledgeArticle, KnowledgeCategory } from '@/types/knowledge-base'

interface UseKnowledgeBaseOptions {
  query?: string
  categoryId?: string | null
}

export function useKnowledgeBase(options: UseKnowledgeBaseOptions = {}) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)

        // 构建查询参数
        const params = new URLSearchParams()
        if (options.query) params.set('q', options.query)
        if (options.categoryId) params.set('category', options.categoryId)

        // 获取文章
        const articlesRes = await fetch(`/api/knowledge-base/articles?${params}`)
        const articlesData = await articlesRes.json()
        setArticles(articlesData.articles || [])

        // 获取分类
        const categoriesRes = await fetch('/api/knowledge-base/categories')
        const categoriesData = await categoriesRes.json()
        setCategories(categoriesData.categories || [])

        setError(null)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [options.query, options.categoryId])

  return { articles, categories, isLoading, error }
}
```

**创建API路由**
```typescript
// src/app/api/knowledge-base/articles/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getKnowledgeBaseArticles } from '@/lib/zammad/knowledge-base'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const categoryId = searchParams.get('category')

    const articles = await getKnowledgeBaseArticles({
      query,
      categoryId
    })

    return NextResponse.json({
      success: true,
      articles,
      total: articles.length
    })
  } catch (error) {
    console.error('[API] Knowledge base articles error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500 }
    )
  }
}
```

### 2.4 SSE连接修复

#### 问题分析
```
SSE错误日志：
- Heartbeat timeout
- SSE connection error
- Reconnecting in 1000ms
```

#### 根本原因
1. **心跳间隔过长**：超过服务器超时时间
2. **重连逻辑缺陷**：重连策略不当
3. **事件处理错误**：错误的事件处理导致连接断开

#### 修复方案

**优化SSE客户端**
```typescript
// src/lib/sse/sse-client.ts
export class SSEClient {
  private eventSource: EventSource | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private readonly heartbeatInterval = 30000 // 30秒
  private readonly reconnectDelay = [1000, 2000, 5000, 10000, 30000] // 递增延迟

  constructor(
    private url: string,
    private onMessage: (event: MessageEvent) => void,
    private onError?: (error: Event) => void
  ) {}

  connect() {
    console.log('[SSE] Connecting to:', this.url)

    this.eventSource = new EventSource(this.url)

    this.eventSource.onopen = () => {
      console.log('[SSE] Connected')
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }

    this.eventSource.onmessage = (event) => {
      console.log('[SSE] Message received:', event.type)
      this.resetHeartbeat()
      this.onMessage(event)
    }

    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error)
      this.stopHeartbeat()

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        console.log('[SSE] Connection closed, attempting reconnect')
        this.reconnect()
      }

      this.onError?.(error)
    }

    // 监听自定义事件
    this.eventSource.addEventListener('heartbeat', () => {
      console.log('[SSE] Heartbeat received')
      this.resetHeartbeat()
    })
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      console.warn('[SSE] Heartbeat timeout, reconnecting...')
      this.reconnect()
    }, this.heartbeatInterval)
  }

  private resetHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    this.startHeartbeat()
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached')
      return
    }

    this.disconnect()

    const delay = this.reconnectDelay[this.reconnectAttempts] || 30000
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  disconnect() {
    console.log('[SSE] Disconnecting')
    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }
}
```

**优化SSE服务器端**
```typescript
// src/app/api/sse/tickets/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      console.log('[SSE] Client connected')

      // 发送初始连接消息
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'connected',
        timestamp: Date.now()
      })}\n\n`))

      // 心跳定时器 - 每15秒发送一次
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'))
          console.log('[SSE] Heartbeat sent')
        } catch (error) {
          console.error('[SSE] Heartbeat error:', error)
          cleanup()
        }
      }, 15000)

      // 监听工单更新
      const ticketListener = (ticket: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'ticket_updated',
            ticket,
            timestamp: Date.now()
          })}\n\n`))
        } catch (error) {
          console.error('[SSE] Send error:', error)
          cleanup()
        }
      }

      // 注册监听器
      subscribeToTicketUpdates(ticketListener)

      // 清理函数
      function cleanup() {
        console.log('[SSE] Cleaning up')
        clearInterval(heartbeatInterval)
        unsubscribeFromTicketUpdates(ticketListener)
      }

      // 处理客户端断开
      request.signal.addEventListener('abort', () => {
        console.log('[SSE] Client disconnected')
        cleanup()
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

## 3. 数据库设计

### 3.1 工单分配表
```sql
CREATE TABLE ticket_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(50) NOT NULL,
  assigned_to_id VARCHAR(50) NOT NULL,
  assigned_by_id VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  unassigned_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_assignee ON ticket_assignments(assigned_to_id);
```

### 3.2 响应模板表
```sql
CREATE TABLE response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  shortcut_key VARCHAR(50),
  variables JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_response_templates_staff ON response_templates(staff_id);
CREATE INDEX idx_response_templates_category ON response_templates(category);
```

### 3.3 对话升级记录表
```sql
CREATE TABLE conversation_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(50) NOT NULL,
  escalated_by_id VARCHAR(50) NOT NULL,
  accepted_by_id VARCHAR(50),
  escalated_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal',
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_escalations_conversation ON conversation_escalations(conversation_id);
CREATE INDEX idx_escalations_status ON conversation_escalations(status);
```

## 4. API设计

### 4.1 工单分配API

#### POST /api/tickets/[id]/assign
```typescript
// 请求
{
  "assignToId": "staff_123",
  "notes": "Customer needs urgent help"
}

// 响应
{
  "success": true,
  "assignment": {
    "id": "assign_xyz",
    "ticketId": "60097",
    "assignedTo": {
      "id": "staff_123",
      "name": "John Doe"
    },
    "assignedAt": "2025-11-12T10:30:00Z"
  }
}
```

#### POST /api/tickets/bulk/assign
```typescript
// 请求
{
  "ticketIds": ["60097", "60096", "60095"],
  "assignToId": "staff_123"
}

// 响应
{
  "success": true,
  "assigned": 3,
  "failed": 0,
  "results": [...]
}
```

### 4.2 响应模板API

#### GET /api/staff/templates
```typescript
// 响应
{
  "success": true,
  "templates": [
    {
      "id": "tpl_1",
      "title": "欢迎消息",
      "content": "您好 {{customerName}}，我是客服 {{staffName}}...",
      "category": "greeting",
      "shortcutKey": "welcome",
      "variables": ["customerName", "staffName"]
    }
  ]
}
```

### 4.3 对话升级API

#### POST /api/conversations/[id]/escalate
```typescript
// 请求
{
  "priority": "high",
  "reason": "Customer is very frustrated"
}

// 响应
{
  "success": true,
  "escalation": {
    "id": "esc_1",
    "conversationId": "conv_123",
    "status": "pending",
    "queuePosition": 3,
    "estimatedWaitTime": "5 minutes"
  }
}
```

## 5. 性能优化

### 5.1 前端优化
- 使用React.memo减少不必要的重渲染
- 实现虚拟滚动处理大列表
- 使用SWR进行数据缓存和重验证
- 代码分割和懒加载

### 5.2 后端优化
- 数据库查询优化（添加索引）
- 实现API响应缓存
- 使用连接池管理数据库连接
- SSE连接池管理

### 5.3 监控指标
- 页面加载时间
- API响应时间
- SSE连接稳定性
- 错误率和崩溃率

## 6. 安全考虑

### 6.1 认证授权
- 验证Staff用户权限
- 实现角色基础访问控制（RBAC）
- API端点权限检查

### 6.2 数据安全
- 工单数据访问控制
- 敏感信息加密
- 审计日志记录

### 6.3 输入验证
- 文件上传验证
- SQL注入防护
- XSS防护

## 7. 部署策略

### 7.1 阶段发布
- Phase 1: Bug修复（灰度10%）
- Phase 2: 核心功能（灰度50%）
- Phase 3: 全量发布（100%）

### 7.2 回滚计划
- 保留前一版本
- 快速回滚机制
- 数据库迁移回滚脚本

### 7.3 监控告警
- 错误率告警
- 性能指标告警
- SSE连接数监控
