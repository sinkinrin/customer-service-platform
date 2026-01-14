import { requireAuth } from '@/lib/utils/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { notificationService } from '@/lib/notification'

// PUT /api/notifications/read-all
export async function PUT() {
  try {
    const user = await requireAuth()
    const updated = await notificationService.markAllAsRead(user.id)
    return successResponse({ updated })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return serverErrorResponse('Failed to mark all as read', error?.message)
  }
}
