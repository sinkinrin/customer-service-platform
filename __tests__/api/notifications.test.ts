/**
 * Notifications API integration tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

import { GET as LIST } from '@/app/api/notifications/route'
import { GET as UNREAD } from '@/app/api/notifications/unread-count/route'
import { PUT as READ_ONE } from '@/app/api/notifications/[id]/read/route'
import { PUT as READ_ALL } from '@/app/api/notifications/read-all/route'
import { DELETE as DELETE_ONE } from '@/app/api/notifications/[id]/route'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('Notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists current user notifications', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'staff',
        email: 'staff@test.com',
        region: 'asia-pacific',
        zammad_id: 10,
      },
    } as any)

    vi.mocked(prisma.notification.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.notification.count).mockResolvedValue(0 as any)

    const response = await LIST(createRequest('http://localhost:3000/api/notifications?limit=20&offset=0'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.notifications).toEqual([])
  })

  it('returns unread count', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'staff',
        email: 'staff@test.com',
        region: 'asia-pacific',
        zammad_id: 10,
      },
    } as any)

    vi.mocked(prisma.notification.count).mockResolvedValue(3 as any)

    const response = await UNREAD()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.unreadCount).toBe(3)
  })

  it('marks own notification as read', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'staff',
        email: 'staff@test.com',
        region: 'asia-pacific',
        zammad_id: 10,
      },
    } as any)

    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: 'n1',
      userId: 'user-1',
      type: 'ticket_reply',
      title: 'T',
      body: 'B',
      data: null,
      read: false,
      readAt: null,
      createdAt: new Date(),
      expiresAt: null,
    } as any)

    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 } as any)

    const response = await READ_ONE(createRequest('http://localhost:3000/api/notifications/n1/read'), {
      params: Promise.resolve({ id: 'n1' }),
    } as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.updated).toBe(true)
  })

  it('prevents deleting other user notifications', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'staff',
        email: 'staff@test.com',
        region: 'asia-pacific',
        zammad_id: 10,
      },
    } as any)

    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: 'n2',
      userId: 'user-2',
      type: 'ticket_reply',
      title: 'T',
      body: 'B',
      data: null,
      read: false,
      readAt: null,
      createdAt: new Date(),
      expiresAt: null,
    } as any)

    const response = await DELETE_ONE(createRequest('http://localhost:3000/api/notifications/n2'), {
      params: Promise.resolve({ id: 'n2' }),
    } as any)
    expect(response.status).toBe(403)
  })

  it('marks all as read', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'staff',
        email: 'staff@test.com',
        region: 'asia-pacific',
        zammad_id: 10,
      },
    } as any)

    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 4 } as any)

    const response = await READ_ALL()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.updated).toBe(4)
  })
})
