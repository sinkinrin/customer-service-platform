/**
 * Ticket assignment API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getTicket: vi.fn(),
    getUser: vi.fn(),
    getGroup: vi.fn(),
    updateTicket: vi.fn(),
    createArticle: vi.fn(),
  },
}))

vi.mock('next-intl/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl/server')>()
  return {
    ...actual,
    getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  }
})

import { PUT } from '@/app/api/tickets/[id]/assign/route'
import { getTranslations } from 'next-intl/server'

import { requireRole } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'

function createMockRequest(url: string, body: any): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('Ticket Assignment API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({
      id: 'admin_001',
      email: 'admin@test.com',
      role: 'admin',
    } as any)

    vi.mocked(getTranslations).mockResolvedValue((key: string) => key)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('assigns ticket and moves state from new to open', async () => {
    const asiaGroupId = getGroupIdByRegion('asia-pacific')

    vi.mocked(zammadClient.getTicket).mockResolvedValue({
      id: 1,
      number: '10001',
      title: 'Test Ticket',
      state_id: 1,
      group_id: asiaGroupId,
      owner_id: null,
    } as any)

    vi.mocked(zammadClient.getUser).mockResolvedValue({
      id: 5,
      email: 'agent@test.com',
      active: true,
      role_ids: [2],
      roles: ['Agent'],
      group_ids: { [asiaGroupId.toString()]: ['full'] },
      firstname: 'Agent',
      lastname: 'One',
    } as any)

    vi.mocked(zammadClient.updateTicket).mockResolvedValue({
      id: 1,
      number: '10001',
      title: 'Test Ticket',
      owner_id: 5,
      group_id: asiaGroupId,
      state_id: 2,
    } as any)

    const request = createMockRequest('http://localhost:3000/api/tickets/1/assign', {
      staff_id: 5,
    })
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(200)
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ owner_id: 5, state_id: 2 })
    )
  })

  it('notifies previous owner when ticket is reassigned', async () => {
    const asiaGroupId = getGroupIdByRegion('asia-pacific')

    vi.mocked(zammadClient.getTicket).mockResolvedValue({
      id: 2,
      number: '10002',
      title: 'Reassign Ticket',
      state_id: 2,
      group_id: asiaGroupId,
      owner_id: 10,
    } as any)

    vi.mocked(zammadClient.getUser)
      .mockResolvedValueOnce({
        id: 10,
        email: 'prev.owner@test.com',
        firstname: 'Prev',
        lastname: 'Owner',
      } as any)
      .mockResolvedValueOnce({
        id: 6,
        email: 'new.agent@test.com',
        active: true,
        role_ids: [2],
        roles: ['Agent'],
        group_ids: { [asiaGroupId.toString()]: ['full'] },
        firstname: 'New',
        lastname: 'Agent',
      } as any)

    vi.mocked(zammadClient.updateTicket).mockResolvedValue({
      id: 2,
      number: '10002',
      title: 'Reassign Ticket',
      owner_id: 6,
      group_id: asiaGroupId,
      state_id: 2,
    } as any)

    const request = createMockRequest('http://localhost:3000/api/tickets/2/assign', {
      staff_id: 6,
    })
    const response = await PUT(request, { params: Promise.resolve({ id: '2' }) })

    expect(response.status).toBe(200)
    expect(zammadClient.createArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_id: 2,
        type: 'email',
        to: 'prev.owner@test.com',
      })
    )
  })
})
