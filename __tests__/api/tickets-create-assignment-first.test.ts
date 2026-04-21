import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@prisma/client', () => ({
  ServiceBaseRegion: {
    AFRICA: 'AFRICA',
    MIDDLE_EAST: 'MIDDLE_EAST',
    ASIA_PACIFIC: 'ASIA_PACIFIC',
    NORTH_AMERICA: 'NORTH_AMERICA',
    LATIN_AMERICA: 'LATIN_AMERICA',
    EUROPE_ZONE_1: 'EUROPE_ZONE_1',
    EUROPE_ZONE_2: 'EUROPE_ZONE_2',
    CIS: 'CIS',
  },
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/health-check', () => ({
  checkZammadHealth: vi.fn().mockResolvedValue({ isHealthy: true }),
  getZammadUnavailableMessage: vi.fn().mockReturnValue('Zammad is unavailable'),
  isZammadUnavailableError: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/zammad/ensure-user', () => ({
  ensureZammadUser: vi.fn(),
}))

vi.mock('@/lib/ticket/auto-assign', () => ({
  autoAssignSingleTicket: vi.fn(),
  handleAssignmentNotification: vi.fn(),
  EXCLUDED_EMAILS: ['support@howentech.com', 'howensupport@howentech.com'],
}))

vi.mock('@/lib/notification', () => ({
  notifyTicketCreated: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketRating: {
      findMany: vi.fn(),
    },
  },
}))

const { mockFindCustomerServiceGroup } = vi.hoisted(() => ({
  mockFindCustomerServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  findCustomerServiceGroup: mockFindCustomerServiceGroup,
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    createTicket: vi.fn(),
    deleteTicket: vi.fn(),
    updateTicket: vi.fn(),
    getAgents: vi.fn(),
  },
}))

import { POST } from '@/app/api/tickets/route'
import { auth } from '@/auth'
import { notifyTicketCreated } from '@/lib/notification'
import { ensureZammadUser } from '@/lib/zammad/ensure-user'
import { zammadClient } from '@/lib/zammad/client'
import { autoAssignSingleTicket, handleAssignmentNotification } from '@/lib/ticket/auto-assign'
import { STAGING_GROUP_ID } from '@/lib/constants/regions'

const customerUser = {
  id: 'cust_001',
  email: 'customer@test.com',
  role: 'customer' as const,
  full_name: 'Test Customer',
  region: 'north-america',
}

function createRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('tickets create assignment-first', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: customerUser,
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as any)
    vi.mocked(ensureZammadUser).mockResolvedValue({ id: 100 } as any)
    vi.mocked(zammadClient.createTicket).mockResolvedValue({
      id: 1,
      number: '10001',
      title: 'Need help',
    } as any)
  })

  it('creates ticket in regional group and assigns fixed owner for assigned customer with available owner', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue({
      customerZammadId: 100,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 222,
      },
    })
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 222,
        email: 'owner@test.com',
        firstname: 'Fixed',
        lastname: 'Owner',
        active: true,
        role_ids: [2],
        group_ids: { '4': ['full'] },
        out_of_office: false,
      },
    ] as any)

    const response = await POST(createRequest({
      title: 'Need help',
      region: 'europe-zone-1',
      article: { subject: 'S', body: 'B' },
    }))

    expect(response.status).toBe(201)
    expect(zammadClient.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 4 }),
      customerUser.email
    )
    expect(zammadClient.updateTicket).toHaveBeenCalledWith(1, { owner_id: 222, state: 'open' })
    expect(autoAssignSingleTicket).not.toHaveBeenCalled()
  })

  it('rolls back created ticket when fixed-owner update fails', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue({
      customerZammadId: 100,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 222,
      },
    })
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 222,
        email: 'owner@test.com',
        firstname: 'Fixed',
        lastname: 'Owner',
        active: true,
        role_ids: [2],
        group_ids: { '4': ['full'] },
        out_of_office: false,
      },
    ] as any)
    vi.mocked(zammadClient.updateTicket).mockRejectedValue(new Error('owner update failed'))
    vi.mocked(zammadClient.deleteTicket).mockResolvedValue(undefined)

    const response = await POST(createRequest({
      title: 'Need help',
      article: { subject: 'S', body: 'B' },
    }))

    expect(response.status).toBe(500)
    expect(zammadClient.deleteTicket).toHaveBeenCalledWith(1, customerUser.email)
    expect(handleAssignmentNotification).not.toHaveBeenCalled()
    expect(notifyTicketCreated).not.toHaveBeenCalled()
  })

  it('creates ticket in staging for unassigned customer', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue(null)

    const response = await POST(createRequest({
      title: 'Need help',
      region: 'europe-zone-1',
      article: { subject: 'S', body: 'B' },
    }))

    expect(response.status).toBe(201)
    expect(zammadClient.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: STAGING_GROUP_ID }),
      customerUser.email
    )
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
    expect(autoAssignSingleTicket).not.toHaveBeenCalled()
    expect(handleAssignmentNotification).toHaveBeenCalledWith(
      {
        success: false,
        error: 'Customer has no service group assignment',
      },
      1,
      '10001',
      'Need help',
      'unassigned',
      undefined
    )
  })

  it('creates ticket in staging when assigned owner is unavailable', async () => {
    mockFindCustomerServiceGroup.mockResolvedValue({
      customerZammadId: 100,
      serviceGroup: {
        id: 1,
        name: '亚太 1',
        baseRegion: 'ASIA_PACIFIC',
        staffZammadId: 222,
      },
    })
    vi.mocked(zammadClient.getAgents).mockResolvedValue([
      {
        id: 222,
        email: 'owner@test.com',
        firstname: 'Fixed',
        lastname: 'Owner',
        active: false,
        role_ids: [2],
        group_ids: { '4': ['full'] },
        out_of_office: false,
      },
    ] as any)

    const response = await POST(createRequest({
      title: 'Need help',
      article: { subject: 'S', body: 'B' },
    }))

    expect(response.status).toBe(201)
    expect(zammadClient.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: STAGING_GROUP_ID }),
      customerUser.email
    )
    expect(zammadClient.updateTicket).not.toHaveBeenCalled()
    expect(autoAssignSingleTicket).not.toHaveBeenCalled()
    expect(handleAssignmentNotification).toHaveBeenCalledWith(
      {
        success: false,
        error: 'Assigned service group owner is unavailable',
      },
      1,
      '10001',
      'Need help',
      'asia-pacific',
      undefined
    )
  })
})
