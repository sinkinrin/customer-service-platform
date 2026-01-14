import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { forbiddenResponse, notFoundResponse, successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { notificationService } from '@/lib/notification'
import { prisma } from '@/lib/prisma'

// PUT /api/notifications/[id]/read
export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) return notFoundResponse('Notification not found')
    if (notification.userId !== user.id) return forbiddenResponse('Cannot access other user notifications')

    const updated = await notificationService.markAsRead(id, user.id)
    return successResponse({ updated })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return serverErrorResponse('Failed to mark as read', error?.message)
  }
}
