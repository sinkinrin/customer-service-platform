import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getAllTickets: vi.fn(),
    getAgents: vi.fn(),
    updateTicket: vi.fn(),
  },
}))

vi.mock('@/lib/ticket/customer-binding', () => ({
  findActiveBinding: vi.fn().mockResolvedValue(null),
  findOrCreateBinding: vi.fn().mockResolvedValue({}),
  deactivateBindingByCustomer: vi.fn().mockResolvedValue(0),
}))

import { POST } from '@/app/api/tickets/auto-assign/route'
import { zammadClient } from '@/lib/zammad/client'

describe('ticket auto-assign cutover guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret'
    process.env.SERVICE_GROUP_ASSIGNMENT_CUTOVER = 'true'
  })

  it('does not process unassigned tickets while cutover is active', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      { id: 1, number: '10001', title: 'Unassigned', owner_id: 1, customer_id: 50, group_id: 4, state_id: 1 },
    ] as any)

    const request = new NextRequest('http://localhost:3000/api/tickets/auto-assign', {
      headers: new Headers({ 'x-cron-secret': 'secret' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(503)
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
  })
})
