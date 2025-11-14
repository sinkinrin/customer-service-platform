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
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'
import { readAISettings, writeAISettings, updateEnvFile } from '@/lib/utils/ai-config'

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

    // Read settings from persistent storage
    const settings = readAISettings()

    // Convert to API response format (snake_case)
    const response = {
      enabled: settings.enabled,
      model: settings.model,
      temperature: settings.temperature,
      system_prompt: settings.systemPrompt,
      fastgpt_url: settings.fastgptUrl,
      fastgpt_appid: settings.fastgptAppId,
      fastgpt_api_key: settings.fastgptApiKey,
    }

    return successResponse(response)
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return unauthorizedResponse('You must be logged in')
    }
    if (err.message === 'Forbidden') {
      return forbiddenResponse('Admin access required')
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

    // Prepare settings object (convert from snake_case to camelCase)
    const settings: any = {}
    if (enabled !== undefined) settings.enabled = enabled
    if (model !== undefined) settings.model = model
    if (temperature !== undefined) settings.temperature = temperature
    if (system_prompt !== undefined) settings.systemPrompt = system_prompt
    if (fastgpt_url !== undefined) settings.fastgptUrl = fastgpt_url
    if (fastgpt_appid !== undefined) settings.fastgptAppId = fastgpt_appid
    if (fastgpt_api_key !== undefined) settings.fastgptApiKey = fastgpt_api_key

    // Write settings to persistent storage
    writeAISettings(settings)

    // If API key was provided, update .env.local file
    if (fastgpt_api_key) {
      try {
        updateEnvFile(fastgpt_api_key)
      } catch (error) {
        console.error('[AI Settings] Failed to update .env.local:', error)
        // Continue anyway - settings are still saved to config file
      }
    }

    // Read back the saved settings
    const savedSettings = readAISettings()

    // Convert to API response format (snake_case)
    const response = {
      enabled: savedSettings.enabled,
      model: savedSettings.model,
      temperature: savedSettings.temperature,
      system_prompt: savedSettings.systemPrompt,
      fastgpt_url: savedSettings.fastgptUrl,
      fastgpt_appid: savedSettings.fastgptAppId,
      fastgpt_api_key: savedSettings.fastgptApiKey,
    }

    return successResponse(response)
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return unauthorizedResponse('You must be logged in')
    }
    if (err.message === 'Forbidden') {
      return forbiddenResponse('Admin access required')
    }
    return serverErrorResponse('Failed to update AI settings', err.message)
  }
}

