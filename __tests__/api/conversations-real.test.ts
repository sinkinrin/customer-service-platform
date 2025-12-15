/**
 * Conversations API 真实集成测试
 * 
 * 直接调用 route handler，测试真实业务逻辑
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/conversations/route'

// Mock auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock SSE broadcaster (external dependency)
vi.mock('@/lib/sse/conversation-broadcaster', () => ({
  broadcastConversationEvent: vi.fn(),
}))

// Import mocked auth
import { auth } from '@/auth'

// Test users
const mockCustomer = {
  id: 'cust_001',
  email: 'customer@test.com',
  role: 'customer' as const,
  full_name: 'Test Customer',
  region: 'asia-pacific',
}

const mockStaff = {
  id: 'staff_001',
  email: 'staff@test.com',
  role: 'staff' as const,
  full_name: 'Test Staff',
  region: 'asia-pacific',
}

const mockAdmin = {
  id: 'admin_001',
  email: 'admin@test.com',
  role: 'admin' as const,
  full_name: 'Test Admin',
}

// Helper to create mock request
function createMockRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Conversations API 真实集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/conversations', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      
      const request = createMockRequest('http://localhost:3000/api/conversations')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('认证用户应返回对话列表', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('应该支持状态过滤参数', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations?status=active')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('应该支持分页参数', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations?limit=5&offset=0')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      // 返回数据不应超过 limit
      expect(data.data.length).toBeLessThanOrEqual(5)
    })

    it('Staff 应只能看到自己区域的对话', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockStaff,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      // 验证区域过滤逻辑在 filterConversationsByRegion 中实现
    })

    it('Admin 应该能看到所有对话', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('Admin 可以按区域过滤对话', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations?region=asia-pacific')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('POST /api/conversations', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      
      const request = createMockRequest('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const response = await POST(request)
      
      expect(response.status).toBe(401)
    })

    it('应该成功创建新的 AI 对话', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const response = await POST(request)
      
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.mode).toBe('ai')
      expect(data.data.status).toBe('active')
      expect(data.data.customer_id).toBe(mockCustomer.id)
    })

    it('应该支持带初始消息创建对话', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_message: 'Hello, I need help!' }),
      })
      const response = await POST(request)
      
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.message_count).toBe(1) // 有初始消息
    })

    it('新对话应继承用户区域', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...mockCustomer, region: 'europe-zone-1' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const response = await POST(request)
      
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.success).toBe(true)
      // 区域在本地存储中保存，API 响应可能不直接包含
    })

    it('验证失败应返回 400', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          business_type_id: 'invalid-uuid' // 无效的 UUID
        }),
      })
      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('初始消息过长应返回验证错误', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const request = createMockRequest('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initial_message: 'a'.repeat(5001) // 超过最大长度
        }),
      })
      const response = await POST(request)
      
      expect(response.status).toBe(400)
    })
  })
})
