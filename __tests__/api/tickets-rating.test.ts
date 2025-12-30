/**
 * Ticket rating API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/tickets/[id]/rating/route'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketRating: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

function createRequest(url: string, method: string, body?: any): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('Ticket Rating API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 for unauthenticated rating fetch', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = createRequest('http://localhost:3000/api/tickets/1/rating', 'GET')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(401)
  })

  it('returns rating record when present', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_001', role: 'staff', email: 'staff@test.com' },
    } as any)

    vi.mocked(prisma.ticketRating.findUnique).mockResolvedValue({
      ticketId: 1,
      rating: 'positive',
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/1/rating', 'GET')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.rating).toBe('positive')
  })

  it('rejects rating submissions from non-customers', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_001', role: 'staff', email: 'staff@test.com' },
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/1/rating', 'POST', {
      rating: 'positive',
    })
    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(403)
  })

  it('rejects invalid rating payload', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com' },
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/1/rating', 'POST', {
      rating: 'invalid',
    })
    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(400)
  })

  it('creates rating when none exists', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com' },
    } as any)

    vi.mocked(prisma.ticketRating.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.ticketRating.create).mockResolvedValue({
      ticketId: 1,
      rating: 'positive',
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/1/rating', 'POST', {
      rating: 'positive',
      reason: 'Resolved quickly',
    })
    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.rating).toBe('positive')
    expect(prisma.ticketRating.create).toHaveBeenCalled()
  })

  it('updates rating when existing record is found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com' },
    } as any)

    vi.mocked(prisma.ticketRating.findUnique).mockResolvedValue({
      ticketId: 1,
      rating: 'negative',
    } as any)
    vi.mocked(prisma.ticketRating.update).mockResolvedValue({
      ticketId: 1,
      rating: 'positive',
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/1/rating', 'POST', {
      rating: 'positive',
    })
    const response = await POST(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(200)
    expect(prisma.ticketRating.update).toHaveBeenCalled()
  })
})
