import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { autoAssignSingleTicket } from '@/lib/ticket/auto-assign'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getAgents: vi.fn(),
    searchTicketsRawQuery: vi.fn(),
    updateTicket: vi.fn(),
  },
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  findCustomerServiceGroup: vi.fn(),
}))

vi.mock('@/lib/ticket/customer-binding', () => ({
  findActiveBinding: vi.fn(),
  findOrCreateBinding: vi.fn(),
  deactivateBindingByCustomer: vi.fn(),
}))

import { zammadClient } from '@/lib/zammad/client'
import { findCustomerServiceGroup } from '@/lib/service-groups/customer-assignment-service'
import { findActiveBinding, findOrCreateBinding } from '@/lib/ticket/customer-binding'

describe('autoAssignSingleTicket service-group assignment', () => {
  const asiaGroupId = getGroupIdByRegion('asia-pacific')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('assigns directly to service-group owner when available', async () => {
    vi.mocked(findCustomerServiceGroup).mockResolvedValue({
      customerZammadId: 50,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 100,
      },
    } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'owner@test.com',
        firstname: 'Fixed',
        lastname: 'Owner',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
      {
        id: 101,
        email: 'other@test.com',
        firstname: 'Other',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)
    vi.mocked(zammadClient.updateTicket).mockResolvedValue({} as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

    expect(result.success).toBe(true)
    expect(result.assignedTo?.id).toBe(100)
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, { owner_id: 100, state: 'open' })
  })

  it('returns failure when customer has no service-group assignment', async () => {
    vi.mocked(findCustomerServiceGroup).mockResolvedValue(null)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 101,
        email: 'other@test.com',
        firstname: 'Other',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

    expect(result.success).toBe(false)
    expect(result.error).toContain('service group')
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
  })

  it('returns failure when assigned owner is unavailable instead of load-balancing', async () => {
    vi.mocked(findCustomerServiceGroup).mockResolvedValue({
      customerZammadId: 50,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 100,
      },
    } as any)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 100,
        email: 'owner@test.com',
        firstname: 'Fixed',
        lastname: 'Owner',
        active: false,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
      {
        id: 101,
        email: 'fallback@test.com',
        firstname: 'Fallback',
        lastname: 'Agent',
        active: true,
        role_ids: [2],
        group_ids: { [asiaGroupId]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    const result = await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

    expect(result.success).toBe(false)
    expect(result.error).toContain('unavailable')
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
  })

  it('does not read legacy customer binding in assignment-first path', async () => {
    vi.mocked(findCustomerServiceGroup).mockResolvedValue(null)
    vi.mocked(zammadClient.getAgents).mockResolvedValue([] as any)

    await autoAssignSingleTicket(1, '10001', 'Test', asiaGroupId, undefined, 50)

    expect(findActiveBinding).not.toHaveBeenCalled()
    expect(findOrCreateBinding).not.toHaveBeenCalled()
  })
})
