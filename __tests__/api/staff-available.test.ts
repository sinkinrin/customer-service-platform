/**
 * Staff available API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getAgents: vi.fn(),
    getAllTickets: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
  },
}))

import { requireRole, getCurrentUser } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'

describe('Staff Available API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns error when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const { GET } = await import('@/app/api/staff/available/route')
    const response = await GET()

    expect(response.status).toBe(500)
  })

  it('filters agents by staff accessible groups and hides emails', async () => {
    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    const europeGroupId = getGroupIdByRegion('europe-zone-1')

    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '5',
      email: 'staff@test.com',
      role: 'staff',
      region: 'asia-pacific',
    } as any)
    vi.mocked(requireRole).mockResolvedValue({} as any)

    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 5,
      group_ids: { [asiaGroupId.toString()]: ['full'] },
    } as any)
    vi.mocked(zammadClient.getUserByEmail).mockResolvedValue({
      id: 5,
      group_ids: { [asiaGroupId.toString()]: ['full'] },
    } as any)

    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 10,
        firstname: 'Asia',
        lastname: 'Agent',
        email: 'asia.agent@test.com',
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        out_of_office: true,
        out_of_office_start_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        out_of_office_end_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      {
        id: 11,
        firstname: 'EU',
        lastname: 'Agent',
        email: 'eu.agent@test.com',
        group_ids: { [europeGroupId.toString()]: ['full'] },
        out_of_office: false,
      },
    ] as any)

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      { owner_id: 10, state_id: 1 },
      { owner_id: 10, state_id: 2 },
    ] as any)

    const { GET } = await import('@/app/api/staff/available/route')
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.staff).toHaveLength(1)
    expect(payload.data.staff[0].id).toBe(10)
    expect(payload.data.staff[0].email).toBeUndefined()
    expect(payload.data.staff[0].is_available).toBe(false)
    expect(payload.data.staff[0].ticket_count).toBe(2)
  })

  it('returns agent emails for admin users', async () => {
    const asiaGroupId = getGroupIdByRegion('asia-pacific')

    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '1',
      email: 'admin@test.com',
      role: 'admin',
    } as any)
    vi.mocked(requireRole).mockResolvedValue({} as any)

    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 20,
        firstname: 'Admin',
        lastname: 'Visible',
        email: 'agent@test.com',
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        out_of_office: false,
      },
    ] as any)
    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([] as any)

    const { GET } = await import('@/app/api/staff/available/route')
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.staff[0].email).toBe('agent@test.com')
  })
})
