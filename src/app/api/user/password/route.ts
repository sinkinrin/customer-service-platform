/**
 * User Password API
 *
 * PUT /api/user/password - Update current user password
 *
 * Requires current password verification via Zammad authentication
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'

const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const validation = UpdatePasswordSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { currentPassword, newPassword } = validation.data

    // Get Zammad user ID from session
    const zammadId = user.zammad_id
    if (!zammadId) {
      // Mock users cannot change password
      console.log('[Password] No Zammad ID found for user:', user.email)
      return serverErrorResponse('Password change not available for this account type')
    }

    // Verify current password by attempting authentication
    const authenticatedUser = await zammadClient.authenticateUser(user.email, currentPassword)
    if (!authenticatedUser) {
      return validationErrorResponse([
        { path: ['currentPassword'], message: 'Current password is incorrect' },
      ])
    }

    // Update password in Zammad
    await zammadClient.updateUser(zammadId, {
      password: newPassword,
    })

    return successResponse({
      message: 'Password updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    console.error('[PUT /api/user/password] Error:', error)

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('authentication') || error.message.includes('401')) {
        return validationErrorResponse([
          { path: ['currentPassword'], message: 'Current password is incorrect' },
        ])
      }
    }

    return serverErrorResponse('Failed to update password')
  }
}
