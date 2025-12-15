/**
 * Admin API 集成测试
 *
 * 测试内容：
 * 1. 权限检查（仅 admin 可访问）
 * 2. 用户管理 CRUD
 * 3. 输入验证
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/admin/users/route'

// Mock auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock Zammad client
vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    createUser: vi.fn(),
  },
}))

// Mock mock-auth module
vi.mock('@/lib/mock-auth', () => ({
  mockUsers: {},
  mockPasswords: {},
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers } from '@/lib/mock-auth'

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
  region: 'asia-pacific',
}

// Helper to create mock request
function createMockRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Admin API 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mockUsers
    Object.keys(mockUsers).forEach(key => delete mockUsers[key])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // GET /api/admin/users
  // ============================================================================

  describe('GET /api/admin/users', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/users')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('customer 用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('admin 用户应返回用户列表', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data.users)).toBe(true)
    })

    it('staff 用户应能查看用户列表', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockStaff,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users')
      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  // ============================================================================
  // POST /api/admin/users
  // ============================================================================

  describe('POST /api/admin/users', () => {
    it('未认证用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@test.com',
          password: 'password123',
          full_name: 'New User',
          role: 'customer',
          region: 'asia-pacific',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('staff 用户应返回 401', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockStaff,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@test.com',
          password: 'password123',
          full_name: 'New User',
          role: 'customer',
          region: 'asia-pacific',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })
})

