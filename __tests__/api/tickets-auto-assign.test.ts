/**
 * Ticket auto-assign API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/tickets/auto-assign/route'
import { getGroupIdByRegion } from '@/lib/constants/regions'

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

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  findCustomerServiceGroup: vi.fn().mockResolvedValue(null),
}))

import { requireRole } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'
import { findActiveBinding, findOrCreateBinding } from '@/lib/ticket/customer-binding'
import { findCustomerServiceGroup } from '@/lib/service-groups/customer-assignment-service'

function createRequestWithSecret(secret?: string) {
  const headers = new Headers()
  if (secret) headers.set('x-cron-secret', secret)
  return new NextRequest('http://localhost:3000/api/tickets/auto-assign', { headers })
}

describe('Ticket Auto-Assign API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findActiveBinding).mockResolvedValue(null)
    vi.mocked(findCustomerServiceGroup).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('rejects invalid cron secret', async () => {
    process.env.CRON_SECRET = 'secret'

    const request = createRequestWithSecret('wrong')
    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(requireRole).not.toHaveBeenCalled()
  })

  it('skips role check when cron secret is valid', async () => {
    process.env.CRON_SECRET = 'secret'

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([])

    const request = createRequestWithSecret('secret')
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(requireRole).not.toHaveBeenCalled()
  })

  it('assigns unassigned tickets to service-group owner when available', async () => {
    process.env.CRON_SECRET = 'secret'

    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    vi.mocked(findCustomerServiceGroup).mockResolvedValue({
      customerZammadId: 50,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 20,
      },
    } as any)
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      {
        id: 1,
        number: '10001',
        title: 'Unassigned',
        owner_id: 1,
        customer_id: 50,
        group_id: asiaGroupId,
        state_id: 1,
      },
    ] as any)

    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 20,
        email: 'agent@test.com',
        firstname: 'Agent',
        lastname: 'One',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const request = createRequestWithSecret('secret')
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, { owner_id: 20 })
    expect(findOrCreateBinding).not.toHaveBeenCalled()
  })

  it('returns failure when no service-group assignment exists', async () => {
    process.env.CRON_SECRET = 'secret'

    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      {
        id: 1,
        number: '10001',
        title: 'Unassigned',
        owner_id: 1,
        customer_id: 50,
        group_id: asiaGroupId,
        state_id: 1,
      },
    ] as any)

    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 20,
        email: 'available@test.com',
        firstname: 'Available',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const request = createRequestWithSecret('secret')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
    expect(data.data.failed).toBe(1)
    expect(data.data.results[0].assignedTo).toBeNull()
    expect(findActiveBinding).not.toHaveBeenCalled()
  })

  it('skips staging tickets instead of retrying them', async () => {
    process.env.CRON_SECRET = 'secret'

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      {
        id: 1,
        number: '10001',
        title: 'Staging',
        owner_id: 1,
        customer_id: 50,
        group_id: 9,
        state_id: 1,
      },
    ] as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([] as any)

    const request = createRequestWithSecret('secret')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
    expect(data.data.results[0].error).toContain('staging')
  })
})
