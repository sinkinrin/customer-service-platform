import { prisma } from '@/lib/prisma'
import type { NotificationData } from './types'

function sortObject(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortObject)

  const record = value as Record<string, unknown>
  const sortedKeys = Object.keys(record).sort()
  const result: Record<string, unknown> = {}
  for (const key of sortedKeys) {
    result[key] = sortObject(record[key])
  }
  return result
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value))
}

export async function resolveLocalUserIdsForZammadUserId(zammadUserId: number): Promise<string[]> {
  const results = new Set<string>([`zammad-${zammadUserId}`])

  const mappings = await prisma.userZammadMapping.findMany({
    where: { zammadUserId },
    select: { userId: true },
  })

  for (const mapping of mappings) {
    if (mapping.userId) results.add(mapping.userId)
  }

  return [...results]
}

export async function resolveLocalUserId(zammadUserId: number): Promise<string | null> {
  const ids = await resolveLocalUserIdsForZammadUserId(zammadUserId)
  return ids[0] ?? null
}

export function getNotificationLink(
  data: NotificationData | undefined,
  userRole: 'customer' | 'staff' | 'admin'
): string | null {
  if (!data) return null
  if (data.link) return data.link

  if (data.ticketId != null) {
    const basePaths: Record<typeof userRole, string> = {
      customer: '/customer/my-tickets',
      staff: '/staff/tickets',
      admin: '/admin/tickets',
    }
    return `${basePaths[userRole]}/${data.ticketId}`
  }

  return null
}
