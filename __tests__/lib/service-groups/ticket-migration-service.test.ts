import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  migrateCustomerOpenTicketsToGroup,
  migrateServiceGroupOpenTickets,
} from '@/lib/service-groups/ticket-migration-service'

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: vi.fn(),
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
    vi.resetAllMocks()
  })

  it('migrates all non-closed tickets across every result page for one customer', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
      out_of_office: false,
      email: 'owner@test.com',
    } as any)
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: Array.from({ length: 500 }, (_, index) => ({ id: index + 1, number: `${index + 1}` })),
      tickets_count: 500,
    } as any).mockResolvedValueOnce({
      tickets: Array.from({ length: 500 }, (_, index) => ({ id: index + 1, number: `${index + 1}` })),
      tickets_count: 500,
    } as any).mockResolvedValueOnce({
      tickets: [{ id: 501, number: '501' }],
      tickets_count: 1,
    } as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await migrateCustomerOpenTicketsToGroup(50, 4, 200)

    expect(result).toBe(501)
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('customer_id:50'),
      500,
      undefined,
      1
    )
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('customer_id:50'),
      500,
      undefined,
      2
    )
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, { group_id: 4, owner_id: 200 })
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(501, { group_id: 4, owner_id: 200 })
  })

  it('rolls back already migrated tickets when a later ticket update fails', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
      out_of_office: false,
      email: 'owner@test.com',
    } as any)
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [
        { id: 1, number: '10001', group_id: 2, owner_id: 111 },
        { id: 2, number: '10002', group_id: 2, owner_id: 112 },
      ],
      tickets_count: 2,
    } as any)
    vi.mocked(zammadClient.updateTicket)
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce(new Error('update failed'))
      .mockResolvedValueOnce({} as any)

    await expect(migrateCustomerOpenTicketsToGroup(50, 4, 200)).rejects.toThrow('update failed')

    expect(zammadClient.updateTicket).toHaveBeenNthCalledWith(1, 1, { group_id: 4, owner_id: 200 })
    expect(zammadClient.updateTicket).toHaveBeenNthCalledWith(2, 2, { group_id: 4, owner_id: 200 })
    expect(zammadClient.updateTicket).toHaveBeenNthCalledWith(3, 1, { group_id: 2, owner_id: 111 })
  })

  it('restores null owner_id during rollback instead of forcing system owner', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
      out_of_office: false,
      email: 'owner@test.com',
    } as any)
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [
        { id: 1, number: '10001', group_id: 2, owner_id: null },
        { id: 2, number: '10002', group_id: 2, owner_id: 112 },
      ],
      tickets_count: 2,
    } as any)
    vi.mocked(zammadClient.updateTicket)
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce(new Error('update failed'))
      .mockResolvedValueOnce({} as any)

    await expect(migrateCustomerOpenTicketsToGroup(50, 4, 200)).rejects.toThrow('update failed')

    expect(zammadClient.updateTicket).toHaveBeenNthCalledWith(3, 1, { group_id: 2, owner_id: null })
  })

  it('restores null group_id during rollback instead of leaving target group behind', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
      out_of_office: false,
      email: 'owner@test.com',
    } as any)
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [
        { id: 1, number: '10001', group_id: null, owner_id: 111 },
        { id: 2, number: '10002', group_id: 2, owner_id: 112 },
      ],
      tickets_count: 2,
    } as any)
    vi.mocked(zammadClient.updateTicket)
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce(new Error('update failed'))
      .mockResolvedValueOnce({} as any)

    await expect(migrateCustomerOpenTicketsToGroup(50, 4, 200)).rejects.toThrow('update failed')

    expect(zammadClient.updateTicket).toHaveBeenNthCalledWith(3, 1, { group_id: null, owner_id: 111 })
  })

  it('migrates all customers in a service group', async () => {
    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 200,
      active: true,
      role_ids: [2],
      group_ids: { '4': ['full'] },
      out_of_office: false,
      email: 'owner@test.com',
    } as any)
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
