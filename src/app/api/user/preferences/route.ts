/**
 * User Preferences API
 *
 * GET /api/user/preferences - Get current user notification preferences
 * PUT /api/user/preferences - Update notification preferences
 *
 * Preferences are stored in Zammad user.preferences field
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

type NotificationPreferences = {
  emailNotifications: boolean
  desktopNotifications: boolean
  ticketUpdates: boolean
  conversationReplies: boolean
  promotions: boolean
}

type NotificationPreferenceField = keyof NotificationPreferences

// Default preferences for new users
const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  desktopNotifications: false,
  ticketUpdates: true,
  conversationReplies: true,
  promotions: false,
}

const ZAMMAD_NOTIFICATION_PREFERENCE_KEYS: Record<NotificationPreferenceField, string> = {
  emailNotifications: 'csp_notification_email',
  desktopNotifications: 'csp_notification_desktop',
  ticketUpdates: 'csp_notification_ticket_updates',
  conversationReplies: 'csp_notification_conversation_replies',
  promotions: 'csp_notification_promotions',
}

const NOTIFICATION_PREFERENCE_FIELDS = Object.keys(
  ZAMMAD_NOTIFICATION_PREFERENCE_KEYS
) as NotificationPreferenceField[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }

  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function isDefiniteClientRejection(status: number | undefined): status is number {
  return status !== undefined && status >= 400 && status < 500 && status !== 408
}

function resolveNotificationPreferences(preferences: unknown): NotificationPreferences {
  const storedPreferences = isRecord(preferences) ? preferences : {}
  const legacyPreferences = isRecord(storedPreferences.csp_notifications)
    ? storedPreferences.csp_notifications
    : {}

  return NOTIFICATION_PREFERENCE_FIELDS.reduce<NotificationPreferences>((resolved, field) => {
    const currentValue = storedPreferences[ZAMMAD_NOTIFICATION_PREFERENCE_KEYS[field]]
    const legacyValue = legacyPreferences[field]

    resolved[field] = typeof currentValue === 'boolean'
      ? currentValue
      : typeof legacyValue === 'boolean'
        ? legacyValue
        : DEFAULT_PREFERENCES[field]

    return resolved
  }, { ...DEFAULT_PREFERENCES })
}

function preferenceUpdatesMatch(
  preferences: unknown,
  zammadUpdates: Record<string, boolean>
): boolean {
  if (!isRecord(preferences)) return false

  return Object.entries(zammadUpdates).every(
    ([key, value]) => preferences[key] === value
  )
}

function outcomeUnconfirmedResponse(fields: NotificationPreferenceField[]) {
  return errorResponse(
    'OUTCOME_UNCONFIRMED',
    'The preference update may have succeeded, but its outcome could not be confirmed. Refresh preferences before trying again.',
    { fields },
    503
  )
}

function identityChangedResponse() {
  return errorResponse(
    'IDENTITY_CHANGED',
    'The authenticated user changed before this request was processed. Reload settings and try again.',
    undefined,
    409
  )
}

function hasExpectedUserMismatch(request: NextRequest | undefined, userId: string): boolean {
  const expectedUserId = request?.headers.get('x-csp-expected-user-id')
  return Boolean(expectedUserId && expectedUserId !== userId)
}

const UpdatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  desktopNotifications: z.boolean().optional(),
  ticketUpdates: z.boolean().optional(),
  conversationReplies: z.boolean().optional(),
  promotions: z.boolean().optional(),
})

export async function GET(request?: NextRequest) {
  try {
    const user = await requireAuth()

    if (hasExpectedUserMismatch(request, user.id)) {
      return identityChangedResponse()
    }

    // Get Zammad user ID from session
    const zammadId = user.zammad_id
    if (!zammadId) {
      // Return defaults for mock users
      return successResponse({
        preferences: DEFAULT_PREFERENCES,
      })
    }

    // Fetch current user from Zammad to get preferences
    const zammadUser = await zammadClient.getUser(zammadId)

    return successResponse({
      preferences: resolveNotificationPreferences(zammadUser.preferences),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    logger.error('UserPreferences', 'Failed to get preferences', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse('Failed to get preferences')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (hasExpectedUserMismatch(request, user.id)) {
      return identityChangedResponse()
    }

    const body = await request.json()
    const validation = UpdatePreferencesSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const updates = validation.data

    // Get Zammad user ID from session
    const zammadId = user.zammad_id
    if (!zammadId) {
      // For mock users, just return success with the provided preferences
      return successResponse({
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...updates,
        },
        message: 'Preferences updated (local only - no Zammad ID)',
      })
    }

    // Fetch current preferences from Zammad
    const zammadUser = await zammadClient.getUser(zammadId)
    const currentNotificationPrefs = resolveNotificationPreferences(zammadUser.preferences)
    const zammadUpdates: Record<string, boolean> = {}

    for (const field of NOTIFICATION_PREFERENCE_FIELDS) {
      const value = updates[field]
      if (value !== undefined) {
        zammadUpdates[ZAMMAD_NOTIFICATION_PREFERENCE_KEYS[field]] = value
      }
    }

    const requestedFields = NOTIFICATION_PREFERENCE_FIELDS.filter(
      (field) => updates[field] !== undefined
    )

    if (requestedFields.length === 0) {
      return successResponse({
        preferences: currentNotificationPrefs,
        updateStatus: 'unchanged',
        message: 'No preference changes requested',
      })
    }

    // Each notification setting has its own top-level Zammad key. Concurrent
    // requests therefore update disjoint keys instead of replacing one stale
    // serialized csp_notifications object with another.
    let savedPreferences = {
      ...currentNotificationPrefs,
      ...updates,
    }
    let updateStatus: 'updated' | 'confirmed-after-error' = 'updated'

    try {
      await zammadClient.updateCurrentUserPreferences(
        zammadUpdates,
        String(zammadId)
      )
    } catch (updateError) {
      const status = getHttpStatus(updateError)

      if (isDefiniteClientRejection(status)) {
        return status === 404
          ? errorResponse('NOT_FOUND', 'Zammad user not found', undefined, 404)
          : errorResponse(
              'PREFERENCES_REJECTED',
              'Zammad rejected the preference update',
              { upstreamStatus: status },
              502
            )
      }

      let confirmedUser
      try {
        confirmedUser = await zammadClient.getUser(zammadId)
      } catch (confirmationError) {
        logger.warning('UserPreferences', 'Preference update outcome could not be confirmed', {
          data: {
            zammadId,
            fields: requestedFields,
            updateError: updateError instanceof Error ? updateError.message : updateError,
            confirmationError: confirmationError instanceof Error
              ? confirmationError.message
              : confirmationError,
          },
        })
        return outcomeUnconfirmedResponse(requestedFields)
      }

      if (!preferenceUpdatesMatch(confirmedUser.preferences, zammadUpdates)) {
        logger.warning('UserPreferences', 'Preference update does not yet match after an ambiguous write error', {
          data: {
            zammadId,
            fields: requestedFields,
            updateError: updateError instanceof Error ? updateError.message : updateError,
          },
        })
        return outcomeUnconfirmedResponse(requestedFields)
      }

      savedPreferences = resolveNotificationPreferences(confirmedUser.preferences)
      updateStatus = 'confirmed-after-error'
      logger.warning('UserPreferences', 'Preference response failed but requested values are confirmed', {
        data: {
          zammadId,
          fields: requestedFields,
          updateError: updateError instanceof Error ? updateError.message : updateError,
        },
      })
    }

    return successResponse({
      preferences: savedPreferences,
      updateStatus,
      message: 'Preferences updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    logger.error('UserPreferences', 'Failed to update preferences', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse('Failed to update preferences')
  }
}
