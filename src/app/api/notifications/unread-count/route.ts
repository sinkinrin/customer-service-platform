import { requireAuth } from '@/lib/utils/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { notificationService } from '@/lib/notification'

// GET /api/notifications/unread-count
export async function GET() {
  try {
    const user = await requireAuth()
    const unreadCount = await notificationService.getUnreadCount(user.id)
    return successResponse({ unreadCount })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return serverErrorResponse('Failed to fetch unread count', error?.message)
  }
}
