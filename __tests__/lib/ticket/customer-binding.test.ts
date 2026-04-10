/**
 * Customer-Staff Binding CRUD unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  findActiveBinding,
  findOrCreateBinding,
  deactivateBinding,
  deactivateBindingsByStaff,
  deactivateBindingByCustomer,
  transferBindings,
  listBindings,
} from '@/lib/ticket/customer-binding'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerStaffBinding: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('customer-binding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findActiveBinding', () => {
    it('returns binding when active binding exists for customer', async () => {
      const mockBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 200,
        region: 'asia-pacific', source: 'auto', isActive: true,
      }
      vi.mocked(prisma.customerStaffBinding.findFirst).mockResolvedValue(mockBinding as any)

      const result = await findActiveBinding(100)

      expect(result).toEqual(mockBinding)
      expect(prisma.customerStaffBinding.findFirst).toHaveBeenCalledWith({
        where: { customerZammadId: 100, isActive: true },
      })
    })

    it('returns null when no active binding exists', async () => {
      vi.mocked(prisma.customerStaffBinding.findFirst).mockResolvedValue(null)
      const result = await findActiveBinding(999)
      expect(result).toBeNull()
    })
  })

  describe('findOrCreateBinding (first-write-wins)', () => {
    it('creates a new binding when none exists', async () => {
      const mockBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 200,
        region: 'asia-pacific', source: 'auto', isActive: true,
      }
      vi.mocked(prisma.customerStaffBinding.create).mockResolvedValue(mockBinding as any)

      const result = await findOrCreateBinding(100, 200, 'asia-pacific', 'auto')

      expect(result).toEqual(mockBinding)
    })

    it('returns existing active binding on unique constraint violation', async () => {
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'
      vi.mocked(prisma.customerStaffBinding.create).mockRejectedValue(uniqueError)

      const existingBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 201,
        region: 'asia-pacific', source: 'auto', isActive: true,
      }
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue(existingBinding as any)

      const result = await findOrCreateBinding(100, 200, 'asia-pacific', 'auto')

      expect(result).toEqual(existingBinding)
    })

    it('re-activates deactivated binding on unique constraint violation', async () => {
      const uniqueError = new Error('Unique constraint failed')
      ;(uniqueError as any).code = 'P2002'
      vi.mocked(prisma.customerStaffBinding.create).mockRejectedValue(uniqueError)

      const deactivatedBinding = {
        id: 1, customerZammadId: 100, staffZammadId: 201,
        region: 'asia-pacific', source: 'auto', isActive: false,
        deactivatedAt: new Date(),
      }
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue(deactivatedBinding as any)

      const reactivated = { ...deactivatedBinding, staffZammadId: 200, isActive: true, deactivatedAt: null }
      vi.mocked(prisma.customerStaffBinding.update).mockResolvedValue(reactivated as any)

      const result = await findOrCreateBinding(100, 200, 'asia-pacific', 'auto')

      expect(result).toEqual(reactivated)
      expect(prisma.customerStaffBinding.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          staffZammadId: 200, region: 'asia-pacific', source: 'auto',
          isActive: true, deactivatedAt: null,
        },
      })
    })
  })

  describe('deactivateBinding', () => {
    it('deactivates a single binding by ID', async () => {
      vi.mocked(prisma.customerStaffBinding.update).mockResolvedValue({} as any)
      await deactivateBinding(1)
      expect(prisma.customerStaffBinding.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false, deactivatedAt: expect.any(Date) },
      })
    })
  })

  describe('deactivateBindingsByStaff', () => {
    it('deactivates all bindings for a staff member', async () => {
      vi.mocked(prisma.customerStaffBinding.updateMany).mockResolvedValue({ count: 3 })
      const count = await deactivateBindingsByStaff(200)
      expect(count).toBe(3)
    })
  })

  describe('deactivateBindingByCustomer', () => {
    it('deactivates binding for a customer', async () => {
      vi.mocked(prisma.customerStaffBinding.updateMany).mockResolvedValue({ count: 1 })
      const count = await deactivateBindingByCustomer(100)
      expect(count).toBe(1)
    })
  })

  describe('transferBindings', () => {
    it('transfers all active bindings from one staff to another', async () => {
      vi.mocked(prisma.customerStaffBinding.updateMany).mockResolvedValue({ count: 5 })
      const count = await transferBindings(200, 300)
      expect(count).toBe(5)
    })
  })

  describe('listBindings', () => {
    it('returns paginated results with filters', async () => {
      vi.mocked(prisma.customerStaffBinding.findMany).mockResolvedValue([{ id: 1 }] as any)
      vi.mocked(prisma.customerStaffBinding.count).mockResolvedValue(1)
      const result = await listBindings({ staffZammadId: 200, page: 1, pageSize: 10 })
      expect(result.bindings).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('supports customerZammadId filter', async () => {
      vi.mocked(prisma.customerStaffBinding.findMany).mockResolvedValue([])
      vi.mocked(prisma.customerStaffBinding.count).mockResolvedValue(0)
      await listBindings({ customerZammadId: 100 })
      expect(prisma.customerStaffBinding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerZammadId: 100, isActive: true }),
        })
      )
    })
  })
})
