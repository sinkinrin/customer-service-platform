import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { notificationService } from '@/lib/notification'

function parseBoolean(value: string | null): boolean | undefined {
  if (value == null) return undefined
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return undefined
}

// GET /api/notifications?limit=20&offset=0&unread=true
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') ?? '')
    const offset = Number(searchParams.get('offset') ?? '')
    const unread = parseBoolean(searchParams.get('unread'))

    const result = await notificationService.getUserNotifications({
      userId: user.id,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
      unread,
    })

    return successResponse(result)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return serverErrorResponse('Failed to fetch notifications', error?.message)
  }
}
