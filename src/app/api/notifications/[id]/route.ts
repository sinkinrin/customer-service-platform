import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { forbiddenResponse, notFoundResponse, successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { notificationService } from '@/lib/notification'
import { prisma } from '@/lib/prisma'

// DELETE /api/notifications/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) return notFoundResponse('Notification not found')
    if (notification.userId !== user.id) return forbiddenResponse('Cannot access other user notifications')

    const deleted = await notificationService.delete(id, user.id)
    return successResponse({ deleted })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return serverErrorResponse('Failed to delete notification', error?.message)
  }
}
