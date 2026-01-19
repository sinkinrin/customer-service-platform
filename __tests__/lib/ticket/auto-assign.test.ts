/**
 * Auto-assign single ticket unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { autoAssignSingleTicket, EXCLUDED_EMAILS } from '@/lib/ticket/auto-assign'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getAllTickets: vi.fn(),
    getAgents: vi.fn(),
    updateTicket: vi.fn(),
  },
}))

import { zammadClient } from '@/lib/zammad/client'

describe('autoAssignSingleTicket', () => {
  const asiaGroupId = getGroupIdByRegion('asia-pacific')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('assigns ticket to available agent in the same region', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
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
      state_id: 2,
    })
  })

  it('returns error when no agents available for region', async () => {
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
    vi.mocked(zammadClient.getAgents).mockResolvedValue([])

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No available agents')
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
  })

  it('excludes agents without access to the ticket group', async () => {
    const europeGroupId = getGroupIdByRegion('europe-zone-1')

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
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

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
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
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
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
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([])
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
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      { id: 1, owner_id: 100, state_id: 2 }, // Agent 100 has 1 ticket
      { id: 2, owner_id: 100, state_id: 2 }, // Agent 100 has 2 tickets
      { id: 3, owner_id: 101, state_id: 2 }, // Agent 101 has 1 ticket
    ] as any)
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
    vi.mocked(zammadClient.getAllTickets).mockRejectedValue(new Error('API timeout'))

    const result = await autoAssignSingleTicket(1, '10001', 'Test Ticket', asiaGroupId)

    expect(result.success).toBe(false)
    expect(result.error).toBe('API timeout')
  })
})
