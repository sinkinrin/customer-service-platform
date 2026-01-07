/**
 * Tickets export API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getAllTickets: vi.fn(),
    getUser: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketRating: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { prisma } from '@/lib/prisma'

import { GET as GET_EXPORT } from '@/app/api/tickets/export/route'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('Tickets export API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET_EXPORT(createRequest('http://localhost:3000/api/tickets/export'))
    expect(response.status).toBe(401)
  })

  it('blocks customers from exporting', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: 'customer' } } as any)

    const response = await GET_EXPORT(createRequest('http://localhost:3000/api/tickets/export'))
    expect(response.status).toBe(403)
  })

  it('exports only staff region tickets and includes BOM', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'staff', region: 'asia-pacific', email: 'staff@test.com' },
    } as any)

    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    const europeGroupId = getGroupIdByRegion('europe-zone-1')

    vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
      {
        id: 1,
        number: '10001',
        title: 'Asia ticket',
        group_id: asiaGroupId,
        state_id: 2,
        priority_id: 2,
        customer_id: 10,
        owner_id: 20,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 2,
        number: '10002',
        title: 'Europe ticket',
        group_id: europeGroupId,
        state_id: 2,
        priority_id: 2,
        customer_id: 11,
        owner_id: 21,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ] as any)

    vi.mocked(zammadClient.getUser).mockImplementation(async (id: number) => ({
      id,
      firstname: `User${id}`,
      lastname: 'Test',
      email: `user${id}@test.com`,
    }) as any)

    vi.mocked(prisma.ticketRating.findMany).mockResolvedValue([
      { ticketId: 1, rating: 'positive' },
    ] as any)

    const response = await GET_EXPORT(createRequest('http://localhost:3000/api/tickets/export'))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('tickets-export-')

    const normalized = text.startsWith('\uFEFF') ? text.slice(1) : text
    const lines = normalized.split('\n')
    expect(lines[0]).toContain('Ticket ID')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('Asia ticket')
  })
})
