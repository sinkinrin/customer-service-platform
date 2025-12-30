/**
 * Ticket updates API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/tickets/updates/route'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketUpdate: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('Ticket Updates API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns updates with parsed data payloads', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_001', role: 'staff', email: 'staff@test.com' },
    } as any)

    vi.mocked(prisma.ticketUpdate.findMany).mockResolvedValue([
      {
        id: 'upd_1',
        ticketId: 10,
        event: 'article.created',
        data: JSON.stringify({ author: 'staff@test.com' }),
        createdAt: new Date('2025-01-01T10:00:00Z'),
      },
    ] as any)

    const request = createRequest('http://localhost:3000/api/tickets/updates')
    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.updates).toHaveLength(1)
    expect(payload.data.updates[0].data.author).toBe('staff@test.com')
  })
})
