/**
 * Auto-assign single ticket unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { autoAssignSingleTicket } from '@/lib/ticket/auto-assign'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    searchTicketsRawQuery: vi.fn(),
    getAgents: vi.fn(),
    updateTicket: vi.fn(),
  },
}))

vi.mock('@/lib/ticket/customer-binding', () => ({
  findActiveBinding: vi.fn(),
  findOrCreateBinding: vi.fn(),
  deactivateBindingByCustomer: vi.fn(),
}))

import { zammadClient } from '@/lib/zammad/client'
import { findActiveBinding, findOrCreateBinding, deactivateBindingByCustomer } from '@/lib/ticket/customer-binding'

describe('autoAssignSingleTicket', () => {
  const asiaGroupId = getGroupIdByRegion('asia-pacific')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('assigns ticket to available agent in the same region', async () => {
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'agent@test.com',
        firstname: 'Test',
        lastname: 'Agent',
        active: true,
        role_ids: [2], // Agent role
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(true)
    expect(result.assignedTo).toEqual({
      id: 100,
      name: 'Test Agent',
      email: 'agent@test.com',
    })
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, {
      owner_id: 100,
      state: 'open',
    })
  })

  it('returns error when no agents available for region', async () => {
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([])

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
  })

  it('excludes agents without access to the ticket group', async () => {
    const europeGroupId = getGroupIdByRegion('europe-zone-1')

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'europe-agent@test.com',
        firstname: 'Europe',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [europeGroupId]: ['full'] }, // Only Europe access
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
  })

  it('excludes agents on vacation', async () => {
    const now = new Date()
    const startDate = new Date(now.getTime() - 86400000).toISOString() // Yesterday
    const endDate = new Date(now.getTime() + 86400000).toISOString() // Tomorrow

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'vacation@test.com',
        firstname: 'Vacation',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: true,
        out_of_office_start_at: startDate,
        out_of_office_end_at: endDate,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
  })

  it('excludes admin role agents', async () => {
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'admin@test.com',
        firstname: 'Admin',
        lastname: 'User',
        active: true,
        role_ids: [1, 2], // Admin + Agent
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
  })

  it('excludes system accounts', async () => {
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'support@howentech.com',
        firstname: 'Support',
        lastname: 'System',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
  })

  it('selects agent with lowest ticket load', async () => {
    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [
        { id: 1, owner_id: 100, state_id: 2 }, // Agent 100 has 1 ticket
        { id: 2, owner_id: 100, state_id: 2 }, // Agent 100 has 2 tickets
        { id: 3, owner_id: 101, state_id: 2 }, // Agent 101 has 1 ticket
      ],
      total_count: 3,
    } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'busy@test.com',
        firstname: 'Busy',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
      {
        id: 101,
        email: 'free@test.com',
        firstname: 'Free',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await autoAssignSingleTicket(999, '10099', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(true)
    expect(result.assignedTo?.id).toBe(101) // Free agent with lower load
  })

  it('handles Zammad API errors gracefully', async () => {
    vi.mocked(zammadClient.searchTicketsRawQuery).mockRejectedValue(new Error('API timeout'))

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toBe('API timeout')
  })

  describe('binding-aware assignment', () => {
    it('assigns to bound staff when binding exists and staff is available', async () => {
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'bound-agent@test.com', firstname: 'Bound', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(result.assignedTo?.id).toBe(100)
      expect(findOrCreateBinding).not.toHaveBeenCalled()
      expect(zammadClient.getAgents).toHaveBeenCalledTimes(1)
    })

    it('falls back to load-balancing when bound staff is on vacation', async () => {
      const now = new Date()
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'bound@test.com', firstname: 'Bound', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] },
          out_of_office: true,
          out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
          out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
          out_of_office_replacement_id: null,
        },
        {
          id: 101, email: 'fallback@test.com', firstname: 'Fallback', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(result.assignedTo?.id).toBe(101)
      expect(findOrCreateBinding).not.toHaveBeenCalled()
      expect(zammadClient.getAgents).toHaveBeenCalledTimes(1)
    })

    it('tries vacation replacement before load-balancing', async () => {
      const now = new Date()
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'bound@test.com', firstname: 'Bound', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] },
          out_of_office: true,
          out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
          out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
          out_of_office_replacement_id: 102,
        },
        {
          id: 102, email: 'replacement@test.com', firstname: 'Replacement', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(result.assignedTo?.id).toBe(102)
    })

    it('auto-creates binding on first assignment when no binding exists', async () => {
      vi.mocked(findActiveBinding).mockResolvedValue(null)
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'agent@test.com', firstname: 'Test', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)
      vi.mocked(findOrCreateBinding).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(findOrCreateBinding).toHaveBeenCalledWith(50, 100, 'asia-pacific', 'auto')
    })

    it('skips binding logic when customerId is not provided (backward compat)', async () => {
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'agent@test.com', firstname: 'Test', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId)

      expect(result.success).toBe(true)
      expect(findActiveBinding).not.toHaveBeenCalled()
    })

    it('deactivates stale binding when bound staff is inactive', async () => {
      vi.mocked(findActiveBinding).mockResolvedValue({
        id: 1, customerZammadId: 50, staffZammadId: 100,
        region: 'asia-pacific', source: 'auto', isActive: true,
        createdAt: new Date(), updatedAt: new Date(), deactivatedAt: null,
      })
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'disabled@test.com', firstname: 'Disabled', lastname: 'Agent',
          active: false, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
        {
          id: 101, email: 'fallback@test.com', firstname: 'Fallback', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)
      vi.mocked(deactivateBindingByCustomer).mockResolvedValue(1)
      vi.mocked(findOrCreateBinding).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
      expect(deactivateBindingByCustomer).toHaveBeenCalledWith(50)
      expect(findOrCreateBinding).toHaveBeenCalledWith(50, 101, 'asia-pacific', 'auto')
    })

    it('does not break assignment when binding lookup fails', async () => {
      vi.mocked(findActiveBinding).mockRejectedValue(new Error('DB connection failed'))
      vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({ tickets: [], total_count: 0 } as any)
      vi.mocked(zammadClient.getAgents).mockResolvedValue([
        {
          id: 100, email: 'agent@test.com', firstname: 'Test', lastname: 'Agent',
          active: true, role_ids: [2], group_ids: { [asiaGroupId]: ['full'] }, out_of_office: false,
        },
      ] as any)
      vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)
      vi.mocked(findOrCreateBinding).mockResolvedValue({} as any)

      const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

      expect(result.success).toBe(true)
    })
  })
})
