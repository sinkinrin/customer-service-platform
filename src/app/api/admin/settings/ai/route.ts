/**
 * AI Settings API Route
 *
 * GET  /api/admin/settings/ai - Get AI auto-reply settings
 * PUT  /api/admin/settings/ai - Update AI auto-reply settings
 */

import { NextRequest } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  serverErrorResponse,
  validationErrorResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'
import { mockSettings } from '@/lib/mock-data'

const AISettingsSchema = z.object({
  enabled: z.boolean(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  system_prompt: z.string().optional(),
  fastgpt_url: z.string().optional(),
  fastgpt_appid: z.string().optional(),
  fastgpt_api_key: z.string().optional(),
})

export async function GET(_request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    // Return mock settings
    return successResponse(mockSettings.ai_auto_reply)
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return serverErrorResponse('Unauthorized', 'You must be logged in', 401)
    }
    if (err.message === 'Forbidden') {
      return serverErrorResponse('Forbidden', 'Admin access required', 403)
    }
    return serverErrorResponse('Failed to fetch AI settings', err.message)
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    // Parse and validate request body
    const body = await request.json()
    const validation = AISettingsSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { enabled, model, temperature, system_prompt, fastgpt_url, fastgpt_appid, fastgpt_api_key } = validation.data

    // Update mock settings
    if (enabled !== undefined) mockSettings.ai_auto_reply.enabled = enabled
    if (model !== undefined) mockSettings.ai_auto_reply.model = model
    if (temperature !== undefined) mockSettings.ai_auto_reply.temperature = temperature
    if (system_prompt !== undefined) mockSettings.ai_auto_reply.system_prompt = system_prompt
    if (fastgpt_url !== undefined) mockSettings.ai_auto_reply.fastgpt_url = fastgpt_url
    if (fastgpt_appid !== undefined) mockSettings.ai_auto_reply.fastgpt_appid = fastgpt_appid
    if (fastgpt_api_key !== undefined) mockSettings.ai_auto_reply.fastgpt_api_key = fastgpt_api_key

    return successResponse(mockSettings.ai_auto_reply)
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return serverErrorResponse('Unauthorized', 'You must be logged in', 401)
    }
    if (err.message === 'Forbidden') {
      return serverErrorResponse('Forbidden', 'Admin access required', 403)
    }
    return serverErrorResponse('Failed to update AI settings', err.message)
  }
}

