/**
 * User Profile API
 *
 * GET /api/user/profile - Get current user profile
 * PUT /api/user/profile - Update current user profile (name, phone)
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

const UpdateProfileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').optional(),
  phone: z.string().optional(),
  language: z.string().optional(),
})

export async function GET() {
  try {
    const user = await requireAuth()

    const zammadId = user.zammad_id

    // If user has a Zammad ID, fetch latest data from Zammad
    if (zammadId) {
      try {
        const zammadUser = await zammadClient.getUser(zammadId)
        return successResponse({
          profile: {
            id: user.id,
            email: zammadUser.email,
            full_name: `${zammadUser.firstname || ''} ${zammadUser.lastname || ''}`.trim(),
            phone: zammadUser.phone || '',
            language: zammadUser.preferences?.locale || user.language || 'zh-CN',
            avatar_url: user.avatar_url,
            region: user.region,
          },
        })
      } catch (zammadError) {
        // Fall back to session data if Zammad fetch fails
        console.warn('[GET /api/user/profile] Failed to fetch from Zammad, using session data:', zammadError)
      }
    }

    // Fall back to session data (for mock users or if Zammad fetch failed)
    return successResponse({
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        language: user.language || 'zh-CN',
        avatar_url: user.avatar_url,
        region: user.region,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    console.error('[GET /api/user/profile] Error:', error)
    return serverErrorResponse('Failed to get profile')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const validation = UpdateProfileSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { full_name, phone, language } = validation.data

    // Get Zammad user ID from session
    const zammadId = user.zammad_id
    if (!zammadId) {
      // For mock users without Zammad ID, just return success
      // In production, all users should have a Zammad ID
      console.log('[Profile] No Zammad ID found for user:', user.email)
      return successResponse({
        profile: {
          id: user.id,
          email: user.email,
          full_name: full_name || user.full_name,
          phone: phone || user.phone || '',
          language: language || user.language || 'zh-CN',
        },
        message: 'Profile updated (local only - no Zammad ID)',
      })
    }

    // Build update data for Zammad
    const updateData: Record<string, unknown> = {}

    if (full_name) {
      // Split full_name into firstname and lastname
      const parts = full_name.trim().split(/\s+/)
      updateData.firstname = parts[0] || ''
      updateData.lastname = parts.slice(1).join(' ') || ''
    }

    if (phone !== undefined) {
      updateData.phone = phone
    }

    if (language) {
      // Store language in Zammad preferences
      updateData.preferences = {
        locale: language,
      }
    }

    // Update user in Zammad
    const updatedUser = await zammadClient.updateUser(zammadId, updateData)

    return successResponse({
      profile: {
        id: user.id,
        email: updatedUser.email,
        full_name: `${updatedUser.firstname || ''} ${updatedUser.lastname || ''}`.trim(),
        phone: updatedUser.phone || '',
        language: updatedUser.preferences?.locale || language || 'zh-CN',
      },
      message: 'Profile updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    console.error('[PUT /api/user/profile] Error:', error)
    return serverErrorResponse('Failed to update profile')
  }
}
