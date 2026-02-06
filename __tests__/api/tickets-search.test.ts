/**
 * Ticket search API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/tickets/search/route'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    searchTickets: vi.fn(),
    searchTicketsRawQuery: vi.fn(),
    searchTicketsTotalCount: vi.fn(),
    searchTicketsTotalCountRawQuery: vi.fn(),
    getUsersByIds: vi.fn(),
    searchUsers: vi.fn(),
    searchUsersPaginated: vi.fn(),
    searchUsersTotalCount: vi.fn(),
    createUser: vi.fn(),
  },
}))

vi.mock('@/lib/zammad/health-check', () => ({
  checkZammadHealth: vi.fn().mockResolvedValue({ isHealthy: true }),
  getZammadUnavailableMessage: vi.fn().mockReturnValue('Zammad is unavailable'),
  isZammadUnavailableError: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/cache/zammad-user-cache', () => ({
  getVerifiedZammadUser: vi.fn().mockReturnValue(123),
  setVerifiedZammadUser: vi.fn(),
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('Ticket Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('allows empty query and falls back to base state search', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'admin' },
    } as any)

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [],
      tickets_count: 0,
    } as any)
    vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(0)
    vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([] as any)

    const request = createRequest('http://localhost:3000/api/tickets/search')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
      'state:*',
      10,
      undefined,
      1,
      'created_at',
      'desc'
    )
  })

  it('rejects invalid limit', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'admin' },
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?query=test&limit=201')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('admin searches all tickets without on-behalf-of', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'admin', email: 'admin@test.com' },
    } as any)

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [],
      tickets_count: 0,
    } as any)
    vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(0)
    vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([] as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?query=reset&limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('title:*reset*'),
      5,
      undefined,
      1,
      'created_at',
      'desc'
    )
    expect(zammadClient.searchTicketsTotalCountRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('title:*reset*')
    )
  })

  it('auto mode preserves DSL query syntax for backward compatibility', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'admin', email: 'admin@test.com' },
    } as any)

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [],
      tickets_count: 0,
    } as any)
    vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(0)
    vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([] as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?query=state:*&limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const calledQuery = vi.mocked(zammadClient.searchTicketsRawQuery).mock.calls[0][0] as string
    expect(calledQuery).toContain('state:*')
    expect(calledQuery).not.toContain('title:*state:**')
  })

  it('dsl mode keeps pre-built DSL query unchanged', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'admin', email: 'admin@test.com' },
    } as any)

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [],
      tickets_count: 0,
    } as any)
    vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(0)
    vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([] as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?query=number:10001&queryMode=dsl&limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('number:10001'),
      5,
      undefined,
      1,
      'created_at',
      'desc'
    )
  })

  it('staff searches and filters by region', async () => {
    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    const europeGroupId = getGroupIdByRegion('europe-zone-1')

    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'staff_001',
        role: 'staff',
        email: 'staff@test.com',
        region: 'asia-pacific',
        full_name: 'Test Staff',
        zammad_id: 501,
        group_ids: [asiaGroupId],
      },
    } as any)

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [
        { id: 1, owner_id: 999, group_id: asiaGroupId, customer_id: 100, priority_id: 2, state_id: 2 },
        { id: 2, owner_id: 999, group_id: europeGroupId, customer_id: 200, priority_id: 2, state_id: 2 },
      ],
      tickets_count: 2,
    } as any)
    vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(2)
    vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([
      {
        id: 100,
        firstname: 'Cust',
        lastname: 'One',
        email: 'cust@test.com',
      },
      {
        id: 200,
        firstname: 'Cust',
        lastname: 'Two',
        email: 'cust2@test.com',
      },
    ] as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?query=test&limit=5')
    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.tickets).toHaveLength(1)
    expect(payload.data.tickets[0].group_id).toBe(asiaGroupId)
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('title:*test*'),
      5,
      undefined,
      1,
      'created_at',
      'desc'
    )
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('NOT owner_id:null'),
      5,
      undefined,
      1,
      'created_at',
      'desc'
    )
    expect(zammadClient.searchTicketsTotalCountRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('NOT owner_id:null')
    )
  })

  it('customer searches only their tickets', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        role: 'customer',
        email: 'customer@test.com',
        region: 'asia-pacific',
        full_name: 'Test Customer',
      },
    } as any)

    vi.mocked(zammadClient.searchTicketsRawQuery).mockResolvedValue({
      tickets: [],
      tickets_count: 0,
    } as any)
    vi.mocked(zammadClient.searchTicketsTotalCountRawQuery).mockResolvedValue(0)
    vi.mocked(zammadClient.getUsersByIds).mockResolvedValue([] as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?query=test&limit=5')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(zammadClient.searchTicketsRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('title:*test*'),
      5,
      'customer@test.com',
      1,
      'created_at',
      'desc'
    )
  })

  it('rejects dirty group_id values', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'admin' },
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?group_id=101abc')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('rejects invalid queryMode', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { role: 'admin' },
    } as any)

    const request = createRequest('http://localhost:3000/api/tickets/search?query=reset&queryMode=legacy')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })
})
