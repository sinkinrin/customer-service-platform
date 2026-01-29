/**
 * AI Connectivity Test API
 *
 * POST /api/admin/settings/ai/test - Test AI provider connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import { readAISettings } from '@/lib/utils/ai-config'
import { FastGPTProvider, OpenAICompatProvider, YuxiLegacyProvider } from '@/lib/ai/providers'

const providers = {
  fastgpt: new FastGPTProvider(),
  openai: new OpenAICompatProvider(),
  'yuxi-legacy': new YuxiLegacyProvider(),
}

export async function POST(_request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const settings = readAISettings()

    if (!settings.enabled) {
      return NextResponse.json({
        success: false,
        error: 'AI is not enabled',
      })
    }

    const provider = providers[settings.provider]
    if (!provider) {
      return NextResponse.json({
        success: false,
        error: `Unknown provider: ${settings.provider}`,
      })
    }

    const startTime = Date.now()
    const result = await provider.testConnection(settings)
    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: result.success,
      provider: settings.provider,
      error: result.error,
      responseTime,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
