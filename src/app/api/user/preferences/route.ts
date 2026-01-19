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

// Default preferences for new users
const DEFAULT_PREFERENCES = {
  emailNotifications: true,
  desktopNotifications: false,
  ticketUpdates: true,
  conversationReplies: true,
  promotions: false,
}

const UpdatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  desktopNotifications: z.boolean().optional(),
  ticketUpdates: z.boolean().optional(),
  conversationReplies: z.boolean().optional(),
  promotions: z.boolean().optional(),
})

export async function GET() {
  try {
    const user = await requireAuth()

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

    // Extract notification preferences from Zammad preferences
    // Stored under preferences.csp_notifications
    const storedPrefs = zammadUser.preferences?.csp_notifications || {}

    return successResponse({
      preferences: {
        emailNotifications: storedPrefs.emailNotifications ?? DEFAULT_PREFERENCES.emailNotifications,
        desktopNotifications: storedPrefs.desktopNotifications ?? DEFAULT_PREFERENCES.desktopNotifications,
        ticketUpdates: storedPrefs.ticketUpdates ?? DEFAULT_PREFERENCES.ticketUpdates,
        conversationReplies: storedPrefs.conversationReplies ?? DEFAULT_PREFERENCES.conversationReplies,
        promotions: storedPrefs.promotions ?? DEFAULT_PREFERENCES.promotions,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    console.error('[GET /api/user/preferences] Error:', error)
    return serverErrorResponse('Failed to get preferences')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

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
      console.log('[Preferences] No Zammad ID found for user:', user.email)
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
    const currentPrefs = zammadUser.preferences || {}
    const currentNotificationPrefs = currentPrefs.csp_notifications || {}

    // Merge with new preferences
    const newNotificationPrefs = {
      ...currentNotificationPrefs,
      ...updates,
    }

    // Update user in Zammad with merged preferences
    // Note: We need to preserve other preferences while updating csp_notifications
    const updatedUser = await zammadClient.updateUser(zammadId, {
      preferences: {
        ...currentPrefs,
        csp_notifications: newNotificationPrefs,
      },
    } as any)

    const savedPrefs = updatedUser.preferences?.csp_notifications || newNotificationPrefs

    return successResponse({
      preferences: {
        emailNotifications: savedPrefs.emailNotifications ?? DEFAULT_PREFERENCES.emailNotifications,
        desktopNotifications: savedPrefs.desktopNotifications ?? DEFAULT_PREFERENCES.desktopNotifications,
        ticketUpdates: savedPrefs.ticketUpdates ?? DEFAULT_PREFERENCES.ticketUpdates,
        conversationReplies: savedPrefs.conversationReplies ?? DEFAULT_PREFERENCES.conversationReplies,
        promotions: savedPrefs.promotions ?? DEFAULT_PREFERENCES.promotions,
      },
      message: 'Preferences updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    console.error('[PUT /api/user/preferences] Error:', error)
    return serverErrorResponse('Failed to update preferences')
  }
}
