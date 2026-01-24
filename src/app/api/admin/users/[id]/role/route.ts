import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { mockUpdateUserRole, mockGetUserById } from '@/lib/mock-auth'
import { notifyAccountRoleChanged } from '@/lib/notification'
import { logger } from '@/lib/utils/logger'

// Helper for bad request
const badRequestResponse = (message: string) => errorResponse('BAD_REQUEST', message, undefined, 400)

const UpdateUserRoleSchema = z.object({
  role: z.enum(['customer', 'staff', 'admin'])
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = UpdateUserRoleSchema.safeParse(body)
    if (!parsed.success) {
      return badRequestResponse('Invalid body: role must be one of customer|staff|admin')
    }

    // Verify current user is authenticated and is admin
    const currentUser = await requireAuth()
    if (currentUser.role !== 'admin') {
      return forbiddenResponse('Admin access required')
    }

    const targetUserId = id
    const nextRole = parsed.data.role

    // Check if target user exists
    const targetUser = await mockGetUserById(targetUserId)
    if (!targetUser) {
      return errorResponse('NOT_FOUND', 'User not found', undefined, 404)
    }

    // Update user role using mock auth system
    const updated = await mockUpdateUserRole(targetUserId, nextRole)
    if (!updated) {
      return serverErrorResponse('Failed to update role', 'User update failed')
    }

    try {
      await notifyAccountRoleChanged({
        recipientUserId: updated.id,
        targetUserId: updated.zammad_id,
        targetEmail: updated.email,
        previousRole: targetUser.role,
        nextRole: updated.role,
      })
    } catch (notifyError) {
      logger.warning('UserRole', 'Failed to send role change notification', { data: { targetUserId: updated.id, error: notifyError instanceof Error ? notifyError.message : notifyError } })
    }

    return successResponse({
      user_id: updated.id,
      role: updated.role,
      full_name: updated.full_name,
      email: updated.email,
      updated_at: new Date().toISOString()
    })
  } catch (e: any) {
    if (e.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (e.message === 'Forbidden') {
      return forbiddenResponse()
    }
    return serverErrorResponse('Unexpected error', e?.message)
  }
}
