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
    deleteUser: vi.fn(),
    searchUsersPaginated: vi.fn(),
    searchUsersTotalCount: vi.fn(),
  },
}))

// Mock mock-auth module
vi.mock('@/lib/mock-auth', () => ({
  mockUsers: {},
  mockPasswords: {},
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  assignCustomerToServiceGroup: vi.fn(),
  getCustomerAssignmentRegion: vi.fn(),
  listCustomerAssignmentRegions: vi.fn(),
}))

vi.mock('@/lib/service-groups/service-group-service', () => ({
  getServiceGroup: vi.fn(),
}))

import { auth } from '@/auth'
import { mockUsers } from '@/lib/mock-auth'
import { zammadClient } from '@/lib/zammad/client'
import {
  assignCustomerToServiceGroup,
  getCustomerAssignmentRegion,
  listCustomerAssignmentRegions,
} from '@/lib/service-groups/customer-assignment-service'
import { getServiceGroup } from '@/lib/service-groups/service-group-service'

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
    vi.mocked(zammadClient.searchUsersPaginated).mockResolvedValue([] as any)
    vi.mocked(zammadClient.searchUsersTotalCount).mockResolvedValue(0)
    vi.mocked(getCustomerAssignmentRegion).mockResolvedValue(undefined)
    vi.mocked(listCustomerAssignmentRegions).mockResolvedValue(new Map())
    vi.mocked(getServiceGroup).mockResolvedValue(null as any)
    vi.mocked(assignCustomerToServiceGroup).mockResolvedValue({} as any)
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

    it('staff 用户应只能看到自己区域的用户', async () => {
      // Staff 用户在 asia-pacific 区域
      vi.mocked(auth).mockResolvedValue({
        user: mockStaff,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      // 构造跨区域测试数据，验证服务端强制按 staff 自身区域过滤
      mockUsers['ap-customer@test.com'] = {
        id: 'cust_ap_001',
        email: 'ap-customer@test.com',
        role: 'customer',
        full_name: 'AP Customer',
        region: 'asia-pacific',
      } as any
      mockUsers['ap-staff@test.com'] = {
        id: 'staff_ap_002',
        email: 'ap-staff@test.com',
        role: 'staff',
        full_name: 'AP Staff',
        region: 'asia-pacific',
      } as any
      mockUsers['eu-customer@test.com'] = {
        id: 'cust_eu_001',
        email: 'eu-customer@test.com',
        role: 'customer',
        full_name: 'EU Customer',
        region: 'europe-zone-1',
      } as any

      // 即使请求 europe 区域，Staff 也只能看到自己区域
      const request = createMockRequest('http://localhost:3000/api/admin/users?region=europe&source=mock')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data.users)).toBe(true)
      expect(data.data.users.length).toBeGreaterThan(0)
      expect(data.data.pagination.total).toBe(2)
      expect(data.data.users.every((user: any) => user.region === 'asia-pacific')).toBe(true)
      expect(data.data.users.some((user: any) => user.email === 'eu-customer@test.com')).toBe(false)
    })

    it('admin 可以查看所有区域的用户', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      // Admin 可以过滤任意区域
      const request = createMockRequest('http://localhost:3000/api/admin/users?region=europe&source=mock')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('支持搜索过滤用户', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users?search=test&source=mock')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.pagination).toBeDefined()
    })

    it('支持角色过滤', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users?role=customer&source=mock')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
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

    it('创建 customer 时未提供 serviceGroupId 应返回 400', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@test.com',
          password: 'password123',
          full_name: 'New User',
          role: 'customer',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.details).toContainEqual(
        expect.objectContaining({ path: ['serviceGroupId'] })
      )
      expect(zammadClient.createUser).not.toHaveBeenCalled()
    })

    it('创建 customer 时应写入 service-group assignment', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      vi.mocked(getServiceGroup).mockResolvedValue({
        id: 7,
        name: 'APAC Premium',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 22,
        isActive: true,
      } as any)
      vi.mocked(zammadClient.createUser).mockResolvedValue({
        id: 301,
        email: 'new@test.com',
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new@test.com',
          password: 'password123',
          full_name: 'New User',
          role: 'customer',
          serviceGroupId: 7,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(zammadClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@test.com',
          roles: ['Customer'],
          group_ids: undefined,
        })
      )
      expect(assignCustomerToServiceGroup).toHaveBeenCalledWith(301, 7, 'admin-create-user:new@test.com')
    })

    it('创建 customer assignment 失败时应回滚删除 Zammad 用户', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      vi.mocked(getServiceGroup).mockResolvedValue({
        id: 7,
        name: 'APAC Premium',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 22,
        isActive: true,
      } as any)
      vi.mocked(zammadClient.createUser).mockResolvedValue({
        id: 401,
        email: 'rollback@test.com',
      } as any)
      vi.mocked(assignCustomerToServiceGroup).mockRejectedValue(new Error('Assignment failed'))

      const request = createMockRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rollback@test.com',
          password: 'password123',
          full_name: 'Rollback User',
          role: 'customer',
          serviceGroupId: 7,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(zammadClient.deleteUser).toHaveBeenCalledWith(401)
    })
  })
})

