/**
 * Auth API 集成测试
 *
 * 测试内容：
 * 1. 认证工具函数
 * 2. 权限检查
 * 3. Session 验证
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requireAuth, requireRole, getCurrentUser } from '@/lib/utils/auth'

// Mock auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

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
  region: 'asia-pacific',
}

describe('Auth 工具函数测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // requireAuth
  // ============================================================================

  describe('requireAuth', () => {
    it('未认证时应抛出 Unauthorized 错误', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })

    it('session 无用户时应抛出 Unauthorized 错误', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: null,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })

    it('认证用户应返回用户对象', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const user = await requireAuth()
      expect(user.email).toBe('customer@test.com')
      expect(user.role).toBe('customer')
    })
  })

  // ============================================================================
  // requireRole
  // ============================================================================

  describe('requireRole', () => {
    it('未认证时应抛出 Unauthorized 错误', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      await expect(requireRole(['admin'])).rejects.toThrow('Unauthorized')
    })

    it('角色不匹配时应抛出 Forbidden 错误', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      await expect(requireRole(['admin'])).rejects.toThrow('Forbidden')
    })

    it('角色匹配时应返回用户对象', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockAdmin,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const user = await requireRole(['admin'])
      expect(user.role).toBe('admin')
    })

    it('应支持多个角色', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockStaff,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const user = await requireRole(['admin', 'staff'])
      expect(user.role).toBe('staff')
    })
  })

  // ============================================================================
  // getCurrentUser
  // ============================================================================

  describe('getCurrentUser', () => {
    it('未认证时应返回 null', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const user = await getCurrentUser()
      expect(user).toBeNull()
    })

    it('认证用户应返回用户对象', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: mockCustomer,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)

      const user = await getCurrentUser()
      expect(user?.email).toBe('customer@test.com')
    })
  })
})

