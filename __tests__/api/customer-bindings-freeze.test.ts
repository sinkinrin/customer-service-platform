import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/ticket/customer-binding', () => ({
  setBinding: vi.fn(),
  transferBindings: vi.fn(),
  deactivateBinding: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerStaffBinding: {
      findUnique: vi.fn(),
    },
  },
}))

import { requireRole } from '@/lib/utils/auth'
import { setBinding, transferBindings, deactivateBinding } from '@/lib/ticket/customer-binding'
import { prisma } from '@/lib/prisma'

describe('legacy customer binding mutation freeze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ id: 'admin1', role: 'admin' } as any)
    process.env.SERVICE_GROUP_ASSIGNMENT_CUTOVER = 'true'
  })

  it('blocks manual binding creation while cutover is active', async () => {
    const { POST } = await import('@/app/api/admin/customer-bindings/route')
    const request = new Request('http://localhost/api/admin/customer-bindings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerZammadId: 100, staffZammadId: 200, region: 'asia-pacific' }),
    }) as any

    const response = await POST(request)

    expect(response.status).toBe(503)
    expect(setBinding).not.toHaveBeenCalled()
  })

  it('blocks bulk binding transfer while cutover is active', async () => {
    const { POST } = await import('@/app/api/admin/customer-bindings/transfer/route')
    const request = new Request('http://localhost/api/admin/customer-bindings/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromStaffZammadId: 200, toStaffZammadId: 300 }),
    }) as any

    const response = await POST(request)

    expect(response.status).toBe(503)
    expect(transferBindings).not.toHaveBeenCalled()
  })

  it('blocks binding deletion while cutover is active', async () => {
    vi.mocked(prisma.customerStaffBinding.findUnique).mockResolvedValue({ id: 1, isActive: true } as any)

    const { DELETE } = await import('@/app/api/admin/customer-bindings/[id]/route')
    const request = new Request('http://localhost/api/admin/customer-bindings/1', { method: 'DELETE' }) as any

    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(503)
    expect(deactivateBinding).not.toHaveBeenCalled()
  })
})
