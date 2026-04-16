import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  migrateCustomerOpenTicketsToGroup,
  migrateServiceGroupOpenTickets,
} from '@/lib/service-groups/ticket-migration-service'

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    searchTicketsRawQuery: vi.fn(),
    updateTicket: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerGroupAssignment: {
      findMany: vi.fn(),
    },
  },
}))

import { zammadClient } from '@/lib/zammad/client'
import { prisma } from '@/lib/prisma'

describe('ticket migration service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('migrates all non-closed tickets for one customer to target group and owner', async () => {
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [
        { id: 1, number: '10001' },
        { id: 2, number: '10002' },
      ],
      tickets_count: 2,
    } as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await migrateCustomerOpenTicketsToGroup(50, 4, 200)

    expect(result).toBe(2)
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, { group_id: 4, owner_id: 200 })
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(2, { group_id: 4, owner_id: 200 })
  })

  it('migrates all customers in a service group', async () => {
    vi.mocked(prisma.customerGroupAssignment.findMany).mockResolvedValue([
      { customerZammadId: 50 },
      { customerZammadId: 51 },
    ] as any)
    vi.mocked(zammadClient.searchTicketsRawQuery)
      .mockResolvedValueOnce({ tickets: [{ id: 1 }], tickets_count: 1 } as any)
      .mockResolvedValueOnce({ tickets: [{ id: 2 }, { id: 3 }], tickets_count: 2 } as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await migrateServiceGroupOpenTickets(7, 4, 200)

    expect(result).toBe(3)
    expect(prisma.customerGroupAssignment.findMany).toHaveBeenCalledWith({
      where: { serviceGroupId: 7 },
      select: { customerZammadId: true },
    })
  })
})
