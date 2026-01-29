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
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import { readAISettings, writeAISettings, updateEnvFile } from '@/lib/utils/ai-config'

const AISettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['fastgpt', 'openai', 'yuxi-legacy']).optional(),

  // FastGPT
  fastgpt_url: z.string().optional(),
  fastgpt_appid: z.string().optional(),
  fastgpt_api_key: z.string().optional(),

  // OpenAI Compatible
  openai_url: z.string().optional(),
  openai_api_key: z.string().optional(),
  openai_model: z.string().optional(),

  // Yuxi-Know Legacy
  yuxi_url: z.string().optional(),
  yuxi_username: z.string().optional(),
  yuxi_password: z.string().optional(),
  yuxi_agent_id: z.string().optional(),

  // Common (legacy)
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  system_prompt: z.string().optional(),
})

export async function GET() {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const settings = readAISettings()

    // Convert to API response format (snake_case)
    const response = {
      enabled: settings.enabled,
      provider: settings.provider,
      // FastGPT
      fastgpt_url: settings.fastgptUrl,
      fastgpt_appid: settings.fastgptAppId,
      fastgpt_api_key: settings.fastgptApiKey ? '********' : '', // Mask
      // OpenAI
      openai_url: settings.openaiUrl,
      openai_api_key: settings.openaiApiKey ? '********' : '',
      openai_model: settings.openaiModel,
      // Yuxi Legacy
      yuxi_url: settings.yuxiUrl,
      yuxi_username: settings.yuxiUsername,
      yuxi_password: settings.yuxiPassword ? '********' : '',
      yuxi_agent_id: settings.yuxiAgentId,
      // Common
      model: settings.model,
      temperature: settings.temperature,
      system_prompt: settings.systemPrompt,
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
    logger.error('AISettings', 'Error fetching settings', { data: { error: err.message } })
    return serverErrorResponse('Failed to fetch AI settings', err.message)
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const body = await request.json()
    const validation = AISettingsSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const data = validation.data

    // Convert from snake_case to camelCase
    const settings: Record<string, unknown> = {}

    if (data.enabled !== undefined) settings.enabled = data.enabled
    if (data.provider !== undefined) settings.provider = data.provider

    // FastGPT
    if (data.fastgpt_url !== undefined) settings.fastgptUrl = data.fastgpt_url
    if (data.fastgpt_appid !== undefined) settings.fastgptAppId = data.fastgpt_appid
    if (data.fastgpt_api_key && data.fastgpt_api_key !== '********') {
      settings.fastgptApiKey = data.fastgpt_api_key
    }

    // OpenAI
    if (data.openai_url !== undefined) settings.openaiUrl = data.openai_url
    if (data.openai_api_key && data.openai_api_key !== '********') {
      settings.openaiApiKey = data.openai_api_key
    }
    if (data.openai_model !== undefined) settings.openaiModel = data.openai_model

    // Yuxi Legacy
    if (data.yuxi_url !== undefined) settings.yuxiUrl = data.yuxi_url
    if (data.yuxi_username !== undefined) settings.yuxiUsername = data.yuxi_username
    if (data.yuxi_password && data.yuxi_password !== '********') {
      settings.yuxiPassword = data.yuxi_password
    }
    if (data.yuxi_agent_id !== undefined) settings.yuxiAgentId = data.yuxi_agent_id

    // Common
    if (data.model !== undefined) settings.model = data.model
    if (data.temperature !== undefined) settings.temperature = data.temperature
    if (data.system_prompt !== undefined) settings.systemPrompt = data.system_prompt

    writeAISettings(settings)

    // Legacy: update .env.local for FastGPT API key
    if (data.fastgpt_api_key && data.fastgpt_api_key !== '********') {
      try {
        updateEnvFile(data.fastgpt_api_key)
      } catch {
        // Continue anyway
      }
    }

    return successResponse({ message: 'Settings saved successfully' })
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return unauthorizedResponse('You must be logged in')
    }
    if (err.message === 'Forbidden') {
      return forbiddenResponse('Admin access required')
    }
    logger.error('AISettings', 'Error saving settings', { data: { error: err.message } })
    return serverErrorResponse('Failed to save AI settings', err.message)
  }
}
