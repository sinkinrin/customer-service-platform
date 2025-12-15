/**
 * Auth 工具函数单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testUsers } from '../fixtures'

// Mock @/auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/auth'

describe('Auth Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('getUserRole', () => {
    it('should return customer for customer user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.customer, email: testUsers.customer.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { getUserRole } = await import('@/lib/utils/auth')
      const role = await getUserRole()
      expect(role).toBe('customer')
    })

    it('should return staff for staff user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.staff, email: testUsers.staff.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { getUserRole } = await import('@/lib/utils/auth')
      const role = await getUserRole()
      expect(role).toBe('staff')
    })

    it('should return admin for admin user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.admin, email: testUsers.admin.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { getUserRole } = await import('@/lib/utils/auth')
      const role = await getUserRole()
      expect(role).toBe('admin')
    })

    it('should return customer (default) for null session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      
      const { getUserRole } = await import('@/lib/utils/auth')
      const role = await getUserRole()
      expect(role).toBe('customer')
    })
  })

  describe('isAdmin', () => {
    it('should return true for admin user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.admin, email: testUsers.admin.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { isAdmin } = await import('@/lib/utils/auth')
      expect(await isAdmin()).toBe(true)
    })

    it('should return false for non-admin user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.customer, email: testUsers.customer.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { isAdmin } = await import('@/lib/utils/auth')
      expect(await isAdmin()).toBe(false)
    })

    it('should return false for null session', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      
      const { isAdmin } = await import('@/lib/utils/auth')
      expect(await isAdmin()).toBe(false)
    })
  })

  describe('isStaff', () => {
    it('should return true for staff user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.staff, email: testUsers.staff.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { isStaff } = await import('@/lib/utils/auth')
      expect(await isStaff()).toBe(true)
    })

    it('should return true for admin user (admin is also staff)', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.admin, email: testUsers.admin.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { isStaff } = await import('@/lib/utils/auth')
      expect(await isStaff()).toBe(true)
    })

    it('should return false for customer user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.customer, email: testUsers.customer.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { isStaff } = await import('@/lib/utils/auth')
      expect(await isStaff()).toBe(false)
    })
  })

  describe('isMockAuthEnabled', () => {
    it('should return true in non-production environment', async () => {
      const { isMockAuthEnabled } = await import('@/lib/utils/auth')
      expect(isMockAuthEnabled()).toBe(true)
    })
  })

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.customer, email: testUsers.customer.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { requireAuth } = await import('@/lib/utils/auth')
      const user = await requireAuth()
      expect(user.email).toBe(testUsers.customer.email)
    })

    it('should throw error when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      
      const { requireAuth } = await import('@/lib/utils/auth')
      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })
  })

  describe('requireRole', () => {
    it('should return user when role is allowed', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.admin, email: testUsers.admin.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { requireRole } = await import('@/lib/utils/auth')
      const user = await requireRole(['admin'])
      expect(user.role).toBe('admin')
    })

    it('should throw error when role is not allowed', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { ...testUsers.customer, email: testUsers.customer.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any)
      
      const { requireRole } = await import('@/lib/utils/auth')
      await expect(requireRole(['admin'])).rejects.toThrow('Forbidden')
    })
  })
})
