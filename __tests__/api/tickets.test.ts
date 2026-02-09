/**
 * Tickets API 集成测试
 *
 * 测试内容：
 * 1. 认证/未认证场景
 * 2. 权限检查（角色和区域）
 * 3. 输入验证
 * 4. 成功/失败响应格式
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/tickets/route'
import { GET as GET_TICKET, DELETE } from '@/app/api/tickets/[id]/route'

// Mock auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock Zammad client
vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getTickets: vi.fn(),
    getAllTickets: vi.fn(),
    searchTickets: vi.fn(),
    searchTicketsRawQuery: vi.fn(),
    searchTicketsTotalCount: vi.fn(),
    searchTicketsTotalCountRawQuery: vi.fn(),
    getTicket: vi.fn(),
    createTicket: vi.fn(),
    updateTicket: vi.fn(),
    deleteTicket: vi.fn(),
    getUser: vi.fn(),
    getUsersByIds: vi.fn(),
    searchUsers: vi.fn(),
    searchUsersPaginated: vi.fn(),
    searchUsersTotalCount: vi.fn(),
    createUser: vi.fn(),
    createArticle: vi.fn(),
  },
}))

// Mock SSE broadcaster
vi.mock('@/lib/sse/ticket-broadcaster', () => ({
  broadcastEvent: vi.fn(),
}))

// Mock health check
vi.mock('@/lib/zammad/health-check', () => ({
  checkZammadHealth: vi.fn().mockResolvedValue({ isHealthy: true }),
  getZammadUnavailableMessage: vi.fn().mockReturnValue('Zammad is unavailable'),
  isZammadUnavailableError: vi.fn().mockReturnValue(false),
}))

// Mock auto-assign module
vi.mock('@/lib/ticket/auto-assign', () => ({
  autoAssignSingleTicket: vi.fn(),
  handleAssignmentNotification: vi.fn(),
}))

// Mock ensureZammadUser (extracted to shared module)
vi.mock('@/lib/zammad/ensure-user', () => ({
  ensureZammadUser: vi.fn().mockResolvedValue({ id: 100 }),
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { checkZammadHealth } from '@/lib/zammad/health-check'
import { autoAssignSingleTicket, handleAssignmentNotification } from '@/lib/ticket/auto-assign'
import { ensureZammadUser } from '@/lib/zammad/ensure-user'

// Test users
const mockCustomer = {
  id: 'cust_001',
  email: 'customer@test.com',
  role: 'customer' as const,
  full_name: 'Test Customer',
  region: 'asia-pacific',
}

const mockAdmin = {
  id: 'admin_001',
  email: 'admin@test.com',
  role: 'admin' as const,
  full_name: 'Test Admin',
  region: 'asia-pacific',
}

// Mock ticket data
const mockTicket = {
  id: 1,
  number: '10001',
  title: 'Test Ticket',
  state_id: 2,
  priority_id: 2,
  group_id: 1,
  customer_id: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Helper to create mock request
function createMockRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Tickets API 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkZammadHealth).mockResolvedValue({ isHealthy: true })
    vi.mocked(ensureZammadUser).mockResolvedValue({ id: 100 } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // GET /api/tickets
  // ============================================================================

  describe('GET /api/tickets', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/tickets')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('认证的 admin 用户应返回所有工单', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
        tickets: [mockTicket],
        tickets_count: 1,
      } as any)
      vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(1)
      vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([{
        id: 100,
        email: 'customer@test.com',
        firstname: 'Test',
        lastname: 'Customer',
      }] as any)

      const request = createMockRequest('http://localhost:3000/api/tickets')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.tickets).toHaveLength(1)
      expect(data.data.tickets[0].id).toBe(1)
    })

    it('认证的 customer 用户应只返回自己的工单', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
        tickets: [mockTicket],
        tickets_count: 1,
      } as any)
      vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(1)
      vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([{
        id: 100,
        email: 'customer@test.com',
        firstname: 'Test',
        lastname: 'Customer',
      }] as any)

      const request = createMockRequest('http://localhost:3000/api/tickets')
      const response = await GET(request)

      expect(response.status).toBe(200)
      // Verify searchTicketsRawQuery was called with customer email for X-On-Behalf-Of
      expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
        'state:*',
        50,
        mockCustomer.email,
        1,
        'created_at',
        'desc'
      )
    })

    it('应将排序参数下推到 Zammad 以保证全局排序', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
        tickets: [mockTicket],
        tickets_count: 1,
      } as any)
      vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(1)
      vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([{
        id: 100,
        email: 'customer@test.com',
        firstname: 'Test',
        lastname: 'Customer',
      }] as any)

      const request = createMockRequest('http://localhost:3000/api/tickets?sort=priority&order=asc&page=2&limit=10')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
        'state:*',
        10,
        undefined,
        2,
        'priority_id',
        'asc'
      )
    })

    it('应将状态、优先级和地区过滤下推到 Zammad 查询', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
        tickets: [mockTicket],
        tickets_count: 1,
      } as any)
      vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(1)
      vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([{
        id: 100,
        email: 'customer@test.com',
        firstname: 'Test',
        lastname: 'Customer',
      }] as any)

      const request = createMockRequest('http://localhost:3000/api/tickets?status=open&priority=3&group_id=101&limit=20&page=1')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('(state_id:1 OR state_id:2)'),
        20,
        undefined,
        1,
        'created_at',
        'desc'
      )
      expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('priority_id:3'),
        20,
        undefined,
        1,
        'created_at',
        'desc'
      )
      expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('group_id:101'),
        20,
        undefined,
        1,
        'created_at',
        'desc'
      )
    })

    it('应拒绝脏 group_id 参数', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets?group_id=101abc')
      const response = await GET(request)

      expect(response.status).toBe(400)
      expect(zammadClient.searchTicketsRawQuery).not.toHaveBeenCalled()
    })

    it('staff 查询应排除 owner_id:null 以避免 total 虚高', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'staff_001',
          email: 'staff@test.com',
          role: 'staff',
          full_name: 'Test Staff',
          region: 'asia-pacific',
          zammad_id: 501,
          group_ids: [1],
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
        tickets: [],
        tickets_count: 0,
      } as any)
      vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(0)
      vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([] as any)

      const request = createMockRequest('http://localhost:3000/api/tickets?page=1&limit=5')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('NOT owner_id:null'),
        5,
        undefined,
        1,
        'created_at',
        'desc'
      )
      expect(zammadClient.searchTicketsTotalCountRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('NOT owner_id:null'),
        undefined
      )
    })

    it('Zammad 不可用时应返回 503', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(checkZammadHealth).mockResolvedValue({
        isHealthy: false,
        error: 'Connection refused',
      })

      const request = createMockRequest('http://localhost:3000/api/tickets')
      const response = await GET(request)

      expect(response.status).toBe(503)
    })
  })

  // ============================================================================
  // POST /api/tickets
  // ============================================================================

  describe('POST /api/tickets', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Ticket',
          article: { subject: 'Test', body: 'Test body' },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('缺少必填字段应返回 400', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          // Missing title and article
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('有效请求应成功创建工单', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.searchUsers).mockResolvedValue([{ id: 100 }] as any)
      vi.mocked(zammadClient.createTicket).mockResolvedValue(mockTicket as any)
      vi.mocked(autoAssignSingleTicket).mockResolvedValue({
        success: true,
        assignedTo: { id: 100, name: 'Test Agent', email: 'agent@test.com' },
      })
      vi.mocked(handleAssignmentNotification).mockResolvedValue(undefined)

      const request = createMockRequest('http://localhost:3000/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Ticket',
          article: { subject: 'Test Subject', body: 'Test body content' },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.ticket.id).toBe(1)
    })

    describe('auto-assignment on creation', () => {
      it('calls autoAssignSingleTicket after ticket creation', async () => {
        vi.mocked(auth).mockResolvedValue({
          user: mockCustomer,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        } as any)

        vi.mocked(zammadClient.searchUsers).mockResolvedValue([{ id: 100 }] as any)
        vi.mocked(zammadClient.createTicket).mockResolvedValue(mockTicket as any)
        vi.mocked(autoAssignSingleTicket).mockResolvedValue({
          success: true,
          assignedTo: { id: 100, name: 'Test Agent', email: 'agent@test.com' },
        })
        vi.mocked(handleAssignmentNotification).mockResolvedValue(undefined)

        const request = createMockRequest('http://localhost:3000/api/tickets', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test Ticket',
            article: { subject: 'Test Subject', body: 'Test body content' },
          }),
        })
        const response = await POST(request)

        expect(response.status).toBe(201)
        expect(autoAssignSingleTicket).toHaveBeenCalledWith(
          expect.any(Number),
          expect.any(String),
          expect.any(String),
          expect.any(Number)
        )
      })

      it('creates ticket successfully even when auto-assign fails', async () => {
        vi.mocked(auth).mockResolvedValue({
          user: mockCustomer,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        } as any)

        vi.mocked(zammadClient.searchUsers).mockResolvedValue([{ id: 100 }] as any)
        vi.mocked(zammadClient.createTicket).mockResolvedValue(mockTicket as any)
        vi.mocked(autoAssignSingleTicket).mockResolvedValue({
          success: false,
          error: 'No available agents',
        })
        vi.mocked(handleAssignmentNotification).mockResolvedValue(undefined)

        const request = createMockRequest('http://localhost:3000/api/tickets', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test Ticket',
            article: { subject: 'Test Subject', body: 'Test body content' },
          }),
        })
        const response = await POST(request)

        // Ticket creation should still succeed
        expect(response.status).toBe(201)
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data.ticket.id).toBe(1)
      })

      it('calls handleAssignmentNotification after auto-assign attempt', async () => {
        vi.mocked(auth).mockResolvedValue({
          user: mockCustomer,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        } as any)

        vi.mocked(zammadClient.searchUsers).mockResolvedValue([{ id: 100 }] as any)
        vi.mocked(zammadClient.createTicket).mockResolvedValue(mockTicket as any)
        vi.mocked(autoAssignSingleTicket).mockResolvedValue({
          success: true,
          assignedTo: { id: 100, name: 'Test Agent', email: 'agent@test.com' },
        })
        vi.mocked(handleAssignmentNotification).mockResolvedValue(undefined)

        const request = createMockRequest('http://localhost:3000/api/tickets', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test Ticket',
            article: { subject: 'Test Subject', body: 'Test body content' },
          }),
        })
        await POST(request)

        // Wait a tick for the async notification call
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(handleAssignmentNotification).toHaveBeenCalledWith(
          expect.objectContaining({ success: true }),
          expect.any(Number),
          expect.any(String),
          expect.any(String),
          expect.any(String)
        )
      })
    })
  })

  // ============================================================================
  // GET /api/tickets/[id]
  // ============================================================================

  describe('GET /api/tickets/[id]', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/tickets/1')
      const response = await GET_TICKET(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(401)
    })

    it('无效的工单 ID 应返回 400', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/invalid')
      const response = await GET_TICKET(request, { params: Promise.resolve({ id: 'invalid' }) })

      expect(response.status).toBe(400)
    })

    it('admin 用户应能访问任何工单', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.getTicket).mockResolvedValue(mockTicket as any)
      vi.mocked(zammadClient.getUser).mockResolvedValue({
        id: 100,
        email: 'customer@test.com',
        firstname: 'Test',
        lastname: 'Customer',
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/1')
      const response = await GET_TICKET(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.ticket.id).toBe(1)
    })

    it('不存在的工单应返回 404', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.getTicket).mockResolvedValue(null as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/999')
      const response = await GET_TICKET(request, { params: Promise.resolve({ id: '999' }) })

      expect(response.status).toBe(404)
    })
  })

  // ============================================================================
  // DELETE /api/tickets/[id]
  // ============================================================================

  describe('DELETE /api/tickets/[id]', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/tickets/1', {
        method: 'DELETE',
      })
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(401)
    })

    it('非 admin 用户应返回 403', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/1', {
        method: 'DELETE',
      })
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(403)
    })

    it('admin 用户应能删除工单', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      vi.mocked(zammadClient.deleteTicket).mockResolvedValue(undefined)

      const request = createMockRequest('http://localhost:3000/api/tickets/1', {
        method: 'DELETE',
      })
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(200)
      expect(zammadClient.deleteTicket).toHaveBeenCalledWith(1)
    })
  })
})

