/**
 * Admin Settings API
 * 
 * GET /api/admin/settings - Get system settings
 * PUT /api/admin/settings - Update system settings
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'

const UpdateSettingsSchema = z.object({
  key: z.string(),
  value: z.any(),
})

export async function GET(_request: NextRequest) {
  try {
    await requireRole(['admin'])

    // Return settings object (using mock data for now)
    const settings = {
      businessTypes: [], // TODO: Implement business types management
      // Add more settings as needed
    }

    return successResponse(settings)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch settings', error.message)
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['admin'])

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateSettingsSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Handle different setting keys
    const { key } = validation.data

    switch (key) {
      case 'businessTypes':
        // Update business types (simplified - in production, use proper CRUD)
        // This is just a placeholder
        break
      default:
        return validationErrorResponse({ key: 'Unknown setting key' })
    }

    return successResponse({ message: 'Settings updated successfully' })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to update settings', error.message)
  }
}

