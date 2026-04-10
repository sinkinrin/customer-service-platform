/**
 * Admin Customer-Staff Binding API tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/ticket/customer-binding', () => ({
  listBindings: vi.fn(),
  setBinding: vi.fn(),
  deactivateBinding: vi.fn(),
  transferBindings: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerStaffBinding: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: vi.fn(),
  },
}))

import { requireRole } from '@/lib/utils/auth'
import { listBindings, setBinding, deactivateBinding, transferBindings } from '@/lib/ticket/customer-binding'
import { prisma } from '@/lib/prisma'
import { zammadClient } from '@/lib/zammad/client'

describe('Admin Customer Bindings API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ id: 'admin1', email: 'admin@test.com', role: 'admin' } as any)
  })

  describe('GET /api/admin/customer-bindings', () => {
    it('returns paginated bindings', async () => {
      vi.mocked(listBindings).mockResolvedValue({
        bindings: [{ id: 1, customerZammadId: 100, staffZammadId: 200 }],
        total: 1, page: 1, pageSize: 50,
      } as any)

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings?page=1') as any
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.total).toBe(1)
    })

    it('supports customerZammadId filter', async () => {
      vi.mocked(listBindings).mockResolvedValue({ bindings: [], total: 0, page: 1, pageSize: 50 } as any)

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings?customerZammadId=100') as any
      await GET(request)

      expect(listBindings).toHaveBeenCalledWith(expect.objectContaining({ customerZammadId: 100 }))
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Unauthorized'))

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings') as any
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('returns 403 when wrong role', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))

      const { GET } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings') as any
      const response = await GET(request)

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/admin/customer-bindings', () => {
    it('creates a manual binding after validating target staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 200, active: true } as any)
      vi.mocked(setBinding).mockResolvedValue({ id: 1, source: 'manual' } as any)

      const { POST } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerZammadId: 100, staffZammadId: 200, region: 'asia-pacific' }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(setBinding).toHaveBeenCalledWith(100, 200, 'asia-pacific')
    })

    it('rejects binding to inactive staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 200, active: false } as any)

      const { POST } = await import('@/app/api/admin/customer-bindings/route')
      const request = new Request('http://localhost/api/admin/customer-bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerZammadId: 100, staffZammadId: 200, region: 'asia-pacific' }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/admin/customer-bindings/transfer', () => {
    it('transfers bindings after validating target staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 300, active: true } as any)
      vi.mocked(transferBindings).mockResolvedValue(5)

      const { POST } = await import('@/app/api/admin/customer-bindings/transfer/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStaffZammadId: 200, toStaffZammadId: 300 }),
      }) as any
      const response = await POST(request)
      const data = await response.json()

      expect(data.data.transferred).toBe(5)
    })

    it('rejects same-staff transfer', async () => {
      const { POST } = await import('@/app/api/admin/customer-bindings/transfer/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStaffZammadId: 200, toStaffZammadId: 200 }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('rejects transfer to inactive staff', async () => {
      vi.mocked(zammadClient.getUser).mockResolvedValue({ id: 300, active: false } as any)

      const { POST } = await import('@/app/api/admin/customer-bindings/transfer/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStaffZammadId: 200, toStaffZammadId: 300 }),
      }) as any
      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/admin/customer-bindings/[id]', () => {
    it('deactivates a binding', async () => {
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue({ id: 1, isActive: true } as any)
      vi.mocked(deactivateBinding).mockResolvedValue({} as any)

      const { DELETE } = await import('@/app/api/admin/customer-bindings/[id]/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/1', { method: 'DELETE' }) as any
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(200)
      expect(deactivateBinding).toHaveBeenCalledWith(1)
    })

    it('returns 404 for non-existent binding', async () => {
      vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/admin/customer-bindings/[id]/route')
      const request = new Request('http://localhost/api/admin/customer-bindings/999', { method: 'DELETE' }) as any
      const response = await DELETE(request, { params: Promise.resolve({ id: '999' }) })

      expect(response.status).toBe(404)
    })
  })
})
