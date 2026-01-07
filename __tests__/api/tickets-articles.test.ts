/**
 * Tickets articles API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/tickets/[id]/articles/route'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getTicket: vi.fn(),
    getUser: vi.fn(),
    getArticlesByTicket: vi.fn(),
    createArticle: vi.fn(),
  },
}))

vi.mock('@/lib/zammad/health-check', () => ({
  checkZammadHealth: vi.fn().mockResolvedValue({ isHealthy: true }),
  getZammadUnavailableMessage: vi.fn().mockReturnValue('Zammad is unavailable'),
  isZammadUnavailableError: vi.fn().mockReturnValue(false),
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'

function createMockRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Tickets Articles API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/tickets/[id]/articles', () => {
    it('returns 401 for unauthenticated users', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/tickets/1/articles')
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(401)
    })

    it('denies staff access to other regions', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'staff_001',
          email: 'staff@test.com',
          role: 'staff',
          full_name: 'Test Staff',
          region: 'asia-pacific',
        },
      } as any)

      const europeGroupId = getGroupIdByRegion('europe-zone-1')
      vi.mocked(zammadClient.getTicket).mockResolvedValue({
        id: 1,
        group_id: europeGroupId,
        customer_id: 100,
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/1/articles')
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(403)
    })

    it('returns 404 when customer does not own the ticket', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'cust_001',
          email: 'customer@test.com',
          role: 'customer',
          full_name: 'Test Customer',
          region: 'asia-pacific',
        },
      } as any)

      vi.mocked(zammadClient.getTicket).mockResolvedValue({
        id: 1,
        group_id: getGroupIdByRegion('asia-pacific'),
        customer_id: 200,
      } as any)

      vi.mocked(zammadClient.getUser).mockResolvedValue({
        id: 200,
        email: 'other@test.com',
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/1/articles')
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(404)
    })

    it('returns articles for customer and uses X-On-Behalf-Of', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'cust_001',
          email: 'customer@test.com',
          role: 'customer',
          full_name: 'Test Customer',
          region: 'asia-pacific',
        },
      } as any)

      vi.mocked(zammadClient.getTicket).mockResolvedValue({
        id: 1,
        group_id: getGroupIdByRegion('asia-pacific'),
        customer_id: 100,
      } as any)

      vi.mocked(zammadClient.getUser).mockResolvedValue({
        id: 100,
        email: 'customer@test.com',
      } as any)

      vi.mocked(zammadClient.getArticlesByTicket).mockResolvedValue([
        { id: 1, body: 'Article' },
      ] as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/1/articles')
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(200)
      expect(zammadClient.getArticlesByTicket).toHaveBeenCalledWith(1, 'customer@test.com')
    })
  })

  describe('POST /api/tickets/[id]/articles', () => {
    it('rejects email articles without recipient', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'staff_001',
          email: 'staff@test.com',
          role: 'staff',
          full_name: 'Test Staff',
          region: 'asia-pacific',
        },
      } as any)

      vi.mocked(zammadClient.getTicket).mockResolvedValue({
        id: 1,
        group_id: getGroupIdByRegion('asia-pacific'),
        customer_id: 100,
      } as any)

      vi.mocked(zammadClient.getUser).mockResolvedValue({
        id: 100,
        email: null,
      } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/1/articles', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Reply',
          body: 'Response',
          type: 'email',
        }),
      })
      const response = await POST(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(400)
    })

    it('creates email articles with explicit recipient', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'staff_001',
          email: 'staff@test.com',
          role: 'staff',
          full_name: 'Test Staff',
          region: 'asia-pacific',
        },
      } as any)

      vi.mocked(zammadClient.getTicket).mockResolvedValue({
        id: 1,
        group_id: getGroupIdByRegion('asia-pacific'),
        customer_id: 100,
      } as any)

      vi.mocked(zammadClient.createArticle).mockResolvedValue({ id: 10 } as any)

      const request = createMockRequest('http://localhost:3000/api/tickets/1/articles', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Reply',
          body: 'Response',
          type: 'email',
          to: 'customer@test.com',
        }),
      })
      const response = await POST(request, { params: Promise.resolve({ id: '1' }) })

      expect(response.status).toBe(201)
      expect(zammadClient.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({
          ticket_id: 1,
          sender: 'Agent',
          to: 'customer@test.com',
        }),
        'staff@test.com'
      )
    })
  })
})
