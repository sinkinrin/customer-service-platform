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
import { logger } from '@/lib/utils/logger'

const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

function hasExpectedUserMismatch(request: NextRequest, userId: string): boolean {
  const expectedUserId = request.headers.get('x-csp-expected-user-id')
  return Boolean(expectedUserId && expectedUserId !== userId)
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }

  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function outcomeUnconfirmedResponse() {
  return errorResponse(
    'OUTCOME_UNCONFIRMED',
    'The password update may have succeeded, but its outcome could not be confirmed. Try signing in with the new password before attempting another change.',
    { phase: 'password' },
    503
  )
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (hasExpectedUserMismatch(request, user.id)) {
      return errorResponse(
        'IDENTITY_CHANGED',
        'The authenticated user changed before this request was processed. Reload settings and try again.',
        undefined,
        409
      )
    }

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
      return serverErrorResponse('Password change not available for this account type')
    }

    // Verify current password without collapsing an upstream outage into an
    // "incorrect password" response. No mutation has been attempted yet.
    let authenticatedUser: Awaited<ReturnType<typeof zammadClient.authenticateUserStrict>>
    try {
      authenticatedUser = await zammadClient.authenticateUserStrict(user.email, currentPassword)
    } catch (authenticationError) {
      logger.warning('UserPassword', 'Current password could not be verified', {
        data: {
          zammadId,
          error: authenticationError instanceof Error
            ? authenticationError.message
            : authenticationError,
        },
      })
      return errorResponse(
        'CURRENT_PASSWORD_VERIFICATION_UNAVAILABLE',
        'The current password could not be verified because Zammad is unavailable',
        undefined,
        503
      )
    }

    if (!authenticatedUser) {
      return validationErrorResponse([
        { path: ['currentPassword'], message: 'Current password is incorrect' },
      ])
    }

    if (authenticatedUser.id !== zammadId) {
      logger.warning('UserPassword', 'Authenticated Zammad user does not match the session identity', {
        data: {
          zammadId,
          authenticatedUserId: authenticatedUser.id,
        },
      })
      return errorResponse(
        'ACCOUNT_IDENTITY_MISMATCH',
        'The authenticated account does not match the current session. Reload or sign in again before changing the password.',
        undefined,
        403
      )
    }

    // Update password in Zammad. A timeout, network failure, 5xx, or lost 2xx
    // response body can occur after the write committed, so never replay the
    // mutation automatically. Confirm only by authenticating with the new
    // password; a negative or unavailable confirmation remains unknown.
    try {
      await zammadClient.updateUser(zammadId, {
        password: newPassword,
      })
    } catch (updateError) {
      const status = getHttpStatus(updateError)

      if (status === 404) {
        logger.warning('UserPassword', 'Zammad explicitly rejected the password update', {
          data: {
            zammadId,
            status,
            error: updateError instanceof Error ? updateError.message : updateError,
          },
        })

        return errorResponse('NOT_FOUND', 'Zammad user not found', undefined, 404)
      }

      if (status === 400 || status === 422) {
        logger.warning('UserPassword', 'Zammad rejected the password policy or payload', {
          data: {
            zammadId,
            status,
            error: updateError instanceof Error ? updateError.message : updateError,
          },
        })
        return errorResponse(
          'PASSWORD_REJECTED',
          'Zammad rejected the password update',
          { upstreamStatus: status },
          422
        )
      }

      if (status === 401 || status === 403) {
        logger.error('UserPassword', 'Zammad did not authorize the password update', {
          data: { zammadId, status },
        })
        return errorResponse(
          'PASSWORD_UPDATE_AUTHORIZATION_FAILED',
          'Zammad did not authorize the password update',
          { upstreamStatus: status },
          502
        )
      }

      // Other received 4xx statuses are definite upstream rejections. A 408
      // is excluded because a proxy timeout can occur after the write reached
      // Zammad, so it must follow the unknown-outcome reconciliation path.
      if (
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        status !== 408
      ) {
        logger.warning('UserPassword', 'Zammad rejected the password update request', {
          data: { zammadId, status },
        })
        return errorResponse(
          'PASSWORD_UPDATE_REJECTED',
          'Zammad rejected the password update request',
          { upstreamStatus: status },
          502
        )
      }

      let confirmedUser: Awaited<ReturnType<typeof zammadClient.authenticateUserStrict>>
      try {
        confirmedUser = await zammadClient.authenticateUserStrict(user.email, newPassword)
      } catch (confirmationError) {
        logger.warning('UserPassword', 'Password update outcome could not be confirmed', {
          data: {
            zammadId,
            updateError: updateError instanceof Error ? updateError.message : updateError,
            confirmationError: confirmationError instanceof Error
              ? confirmationError.message
              : confirmationError,
          },
        })
        return outcomeUnconfirmedResponse()
      }

      if (!confirmedUser || confirmedUser.id !== zammadId) {
        logger.warning('UserPassword', 'New password authentication did not confirm the update', {
          data: {
            zammadId,
            confirmedUserId: confirmedUser?.id ?? null,
            updateError: updateError instanceof Error ? updateError.message : updateError,
          },
        })
        return outcomeUnconfirmedResponse()
      }

      logger.warning('UserPassword', 'Password response failed but the new password is confirmed', {
        data: {
          zammadId,
          updateError: updateError instanceof Error ? updateError.message : updateError,
        },
      })
      return successResponse({
        updateStatus: 'confirmed-after-error',
        message: 'Password updated successfully',
      })
    }

    return successResponse({
      updateStatus: 'updated',
      message: 'Password updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    logger.error('UserPassword', 'Failed to update password', { data: { error: error instanceof Error ? error.message : error } })

    return serverErrorResponse('Failed to update password')
  }
}
