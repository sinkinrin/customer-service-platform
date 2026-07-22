import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CreateNotificationInput, NotificationData } from './types'
import { stableStringify } from './utils'

const DEFAULT_LIST_LIMIT = 20
const DEFAULT_RETENTION_DAYS = 30
const DEDUPE_WINDOW_MS = 5 * 60 * 1000

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function getRetentionStartDate(retentionDays: number): Date {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
}

function getActiveNotificationWhere(
  userId: string,
  retentionDays: number,
  now: Date
): Prisma.NotificationWhereInput {
  return {
    userId,
    createdAt: { gte: getRetentionStartDate(retentionDays) },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  }
}

export class NotificationService {
  async create(input: CreateNotificationInput): Promise<void> {
    const dataString = input.data ? stableStringify(input.data) : null

    const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_MS)
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        data: dataString,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    })

    if (existing?.id) return

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: dataString,
        expiresAt: input.expiresAt,
      },
    })
  }

  async createBulk(inputs: CreateNotificationInput[]): Promise<void> {
    for (const input of inputs) {
      await this.create(input)
    }
  }

  async getUserNotifications(params: {
    userId: string
    limit?: number
    offset?: number
    unread?: boolean
    retentionDays?: number
  }): Promise<{
    notifications: Array<{
      id: string
      type: string
      title: string
      body: string
      data: NotificationData | null
      read: boolean
      readAt: string | null
      createdAt: string
      expiresAt: string | null
    }>
    unreadCount: number
    total: number
  }> {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIST_LIMIT, 1), 100)
    const offset = Math.max(params.offset ?? 0, 0)
    const retentionDays = Math.max(params.retentionDays ?? DEFAULT_RETENTION_DAYS, 1)
    const now = new Date()

    const activeWhere = getActiveNotificationWhere(params.userId, retentionDays, now)
    const where: Prisma.NotificationWhereInput = { ...activeWhere }

    if (params.unread === true) {
      where.read = false
    } else if (params.unread === false) {
      where.read = true
    }

    const [rows, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...activeWhere, read: false } }),
    ])

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: parseJson<NotificationData>(row.data),
        read: row.read,
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      })),
      unreadCount,
      total,
    }
  }

  async getUnreadCount(
    userId: string,
    retentionDays: number = DEFAULT_RETENTION_DAYS
  ): Promise<number> {
    const normalizedRetentionDays = Math.max(retentionDays, 1)
    return prisma.notification.count({
      where: {
        ...getActiveNotificationWhere(userId, normalizedRetentionDays, new Date()),
        read: false,
      },
    })
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId, read: false },
      data: { read: true, readAt: new Date() },
    })
    return result.count > 0
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    })
    return result.count
  }

  async delete(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    })
    return result.count > 0
  }

  async cleanupExpired(retentionDays: number = DEFAULT_RETENTION_DAYS): Promise<number> {
    const normalizedRetentionDays = Math.max(retentionDays, 1)
    const now = new Date()
    const result = await prisma.notification.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { createdAt: { lt: getRetentionStartDate(normalizedRetentionDays) } },
        ],
      },
    })
    return result.count
  }
}

export const notificationService = new NotificationService()
