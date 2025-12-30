/**
 * Ticket reopen API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PUT } from '@/app/api/tickets/[id]/reopen/route'

const mockGetTicket = vi.fn()
const mockUpdateTicket = vi.fn()
const mockCreateArticle = vi.fn()

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  ZammadClient: vi.fn().mockImplementation(() => ({
    getTicket: mockGetTicket,
    updateTicket: mockUpdateTicket,
    createArticle: mockCreateArticle,
  })),
}))

import { auth } from '@/auth'

function createRequest(url: string, body?: any): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('Ticket Reopen API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(401)
  })

  it('rejects invalid ticket id', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_001', role: 'staff', email: 'staff@test.com' },
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/invalid/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: 'invalid' }) })

    expect(response.status).toBe(400)
  })

  it('rejects reopening when ticket is not closed', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'staff_001', role: 'staff', email: 'staff@test.com' },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 2,
      customer_id: 10,
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(400)
  })

  it('prevents customers from reopening others tickets', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 99 },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 4,
      customer_id: 100,
    })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(403)
  })

  it('reopens closed ticket and adds internal note', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'cust_001', role: 'customer', email: 'cust@test.com', zammad_id: 100, full_name: 'Cust' },
    } as any)

    mockGetTicket.mockResolvedValue({
      id: 1,
      state_id: 4,
      customer_id: 100,
    })

    mockUpdateTicket.mockResolvedValue({ id: 1 })

    const request = createRequest('http://localhost:3000/api/tickets/1/reopen')
    const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })

    expect(response.status).toBe(200)
    expect(mockUpdateTicket).toHaveBeenCalledWith(1, { state: 'open' })
    expect(mockCreateArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_id: 1,
        internal: true,
      })
    )
  })
})
