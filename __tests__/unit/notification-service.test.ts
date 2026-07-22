import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { notificationService } from '@/lib/notification'

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates notification when not duplicated', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null as any)

    await notificationService.create({
      userId: 'user-1',
      type: 'ticket_reply',
      title: 'T',
      body: 'B',
      data: { ticketId: 1 },
    })

    expect(prisma.notification.create).toHaveBeenCalled()
  })

  it('dedupes notifications within window', async () => {
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({ id: 'n1' } as any)

    await notificationService.create({
      userId: 'user-1',
      type: 'ticket_reply',
      title: 'T',
      body: 'B',
      data: { ticketId: 1 },
    })

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('marks notification as read', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 } as any)

    const updated = await notificationService.markAsRead('n1', 'user-1')
    expect(updated).toBe(true)
  })

  it('returns notifications list with counts', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: 'n1',
        userId: 'user-1',
        type: 'ticket_reply',
        title: 'T',
        body: 'B',
        data: JSON.stringify({ ticketId: 1 }),
        read: false,
        readAt: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        expiresAt: null,
      },
    ] as any)

    vi.mocked(prisma.notification.count)
      .mockResolvedValueOnce(1 as any) // total
      .mockResolvedValueOnce(1 as any) // unreadCount

    const result = await notificationService.getUserNotifications({ userId: 'user-1' })

    expect(result.total).toBe(1)
    expect(result.unreadCount).toBe(1)
    expect(result.notifications[0].data).toEqual({ ticketId: 1 })
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          createdAt: { gte: expect.any(Date) },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        }),
      })
    )
    expect(prisma.notification.count).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({
        userId: 'user-1',
        read: false,
        createdAt: { gte: expect.any(Date) },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      }),
    })
  })

  it('excludes stale and expired notifications from the unread count', async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(2 as any)

    const count = await notificationService.getUnreadCount('user-1')

    expect(count).toBe(2)
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: 'user-1',
        read: false,
        createdAt: { gte: expect.any(Date) },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      }),
    })
  })

  it('cleans up both explicitly expired and retention-expired notifications', async () => {
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 3 } as any)

    const removed = await notificationService.cleanupExpired()

    expect(removed).toBe(3)
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lt: expect.any(Date) } },
          { createdAt: { lt: expect.any(Date) } },
        ],
      },
    })
  })
})

