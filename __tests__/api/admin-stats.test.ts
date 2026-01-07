/**
 * Admin stats API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getGroupIdByRegion } from '@/lib/constants/regions'

vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    searchTickets: vi.fn(),
    getAllTickets: vi.fn(),
    searchUsers: vi.fn(),
  },
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketRating: {
      findMany: vi.fn(),
    },
  },
}))

import { requireRole } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

import { GET as GET_REGIONS } from '@/app/api/admin/stats/regions/route'
import { GET as GET_TICKETS } from '@/app/api/admin/stats/tickets/route'
import { GET as GET_STAFF } from '@/app/api/admin/stats/staff/route'
import { GET as GET_DASHBOARD } from '@/app/api/admin/stats/dashboard/route'
import { GET as GET_RATINGS } from '@/app/api/admin/stats/ratings/route'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('Admin stats APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('GET /api/admin/stats/regions', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Unauthorized'))

      const response = await GET_REGIONS(createRequest('http://localhost:3000/api/admin/stats/regions'))
      expect(response.status).toBe(401)
    })

    it('aggregates tickets by region and includes unassigned', async () => {
      vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)

      const asiaGroupId = getGroupIdByRegion('asia-pacific')
      const europeGroupId = getGroupIdByRegion('europe-zone-1')

      vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
        { id: 1, group_id: asiaGroupId, state_id: 1 },
        { id: 2, group_id: asiaGroupId, state_id: 2 },
        { id: 3, group_id: europeGroupId, state_id: 4 },
        { id: 4, group_id: null, state_id: 2 },
      ] as any)

      const response = await GET_REGIONS(createRequest('http://localhost:3000/api/admin/stats/regions'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.total).toBe(4)

      const regions = payload.data.regions as Array<{ region: string; total: number; open: number; closed: number; waiting: number }>
      const asia = regions.find(r => r.region === 'asia-pacific')
      const europe = regions.find(r => r.region === 'europe-zone-1')
      const unassigned = regions.find(r => r.region === 'unassigned')

      expect(asia?.total).toBe(2)
      expect(asia?.waiting).toBe(1)
      expect(asia?.open).toBe(1)
      expect(europe?.closed).toBe(1)
      expect(unassigned?.total).toBe(1)
      expect(unassigned?.open).toBe(1)
    })
  })

  describe('GET /api/admin/stats/tickets', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))

      const response = await GET_TICKETS(createRequest('http://localhost:3000/api/admin/stats/tickets'))
      expect(response.status).toBe(401)
    })

    it('builds trend data from recent tickets', async () => {
      vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-10T00:00:00Z'))

      vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
        {
          id: 1,
          created_at: '2024-01-10T01:00:00Z',
          updated_at: '2024-01-10T02:00:00Z',
          state_id: 1,
        },
        {
          id: 2,
          created_at: '2024-01-05T01:00:00Z',
          updated_at: '2024-01-08T02:00:00Z',
          close_at: '2024-01-08T02:00:00Z',
          state_id: 4,
        },
        {
          id: 3,
          created_at: '2023-12-01T00:00:00Z',
          updated_at: '2023-12-02T00:00:00Z',
          state_id: 2,
        },
      ] as any)

      const response = await GET_TICKETS(createRequest('http://localhost:3000/api/admin/stats/tickets?range=7d'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.trend).toHaveLength(7)
      expect(payload.data.summary.totalNew).toBe(2)
      expect(payload.data.summary.totalClosed).toBe(1)
    })
  })

  describe('GET /api/admin/stats/staff', () => {
    it('respects limit and returns team stats', async () => {
      vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      const response = await GET_STAFF(createRequest('http://localhost:3000/api/admin/stats/staff?limit=2'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.staff.length).toBeLessThanOrEqual(2)
      expect(payload.data.teamStats.totalStaff).toBe(payload.data.staff.length)
    })
  })

  describe('GET /api/admin/stats/dashboard', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(requireRole).mockRejectedValue(new Error('Unauthorized'))

      const response = await GET_DASHBOARD(createRequest('http://localhost:3000/api/admin/stats/dashboard'))
      expect(response.status).toBe(401)
    })

    it('computes today stats, trends, and region breakdown', async () => {
      vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', role: 'admin' } as any)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-10T00:00:00Z'))

      const asiaGroupId = getGroupIdByRegion('asia-pacific')
      vi.mocked(zammadClient.getAllTickets).mockResolvedValue([
        {
          id: 1,
          number: '10001',
          title: 'Created today',
          group_id: asiaGroupId,
          state_id: 2,
          created_at: '2024-01-10T01:00:00Z',
          updated_at: '2024-01-10T02:00:00Z',
        },
        {
          id: 2,
          number: '10002',
          title: 'Older ticket',
          group_id: null,
          state_id: 4,
          created_at: '2024-01-05T01:00:00Z',
          updated_at: '2024-01-09T01:00:00Z',
          close_at: '2024-01-09T01:00:00Z',
        },
      ] as any)

      vi.mocked(zammadClient.searchUsers).mockResolvedValue([
        { id: 1, email: 'user1@test.com' },
        { id: 2, email: 'user2@test.com' },
      ] as any)

      const response = await GET_DASHBOARD(createRequest('http://localhost:3000/api/admin/stats/dashboard?trendRange=7d'))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.ticketStats.today.total).toBe(1)
      expect(payload.data.trendData).toHaveLength(7)
      expect(payload.data.totalUsers).toBe(2)

      const regions = payload.data.regionStats as Array<{ region: string }>
      expect(regions.some(r => r.region === 'asia-pacific')).toBe(true)
      expect(regions.some(r => r.region === 'unassigned')).toBe(true)
    })
  })

  describe('GET /api/admin/stats/ratings', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await GET_RATINGS()
      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'staff' } } as any)

      const response = await GET_RATINGS()
      expect(response.status).toBe(403)
    })

    it('computes satisfaction rate from ratings', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as any)
      vi.mocked(prisma.ticketRating.findMany).mockResolvedValue([
        { rating: 'positive', ticketId: 1, reason: null, createdAt: new Date('2024-01-01') },
        { rating: 'positive', ticketId: 2, reason: null, createdAt: new Date('2024-01-02') },
        { rating: 'negative', ticketId: 3, reason: 'slow', createdAt: new Date('2024-01-03') },
      ] as any)

      const response = await GET_RATINGS()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.total).toBe(3)
      expect(payload.data.positive).toBe(2)
      expect(payload.data.negative).toBe(1)
      expect(payload.data.satisfactionRate).toBe(67)
      expect(payload.data.recentNegative).toHaveLength(1)
    })
  })
})
