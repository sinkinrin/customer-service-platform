/**
 * AI Health Check API
 *
 * GET /api/ai/health - Check FastGPT service health
 */

import { NextResponse } from 'next/server'
import { readAISettings } from '@/lib/utils/ai-config'

export async function GET() {
  try {
    const settings = readAISettings()

    // Check if AI is enabled
    if (!settings.enabled) {
      return NextResponse.json({
        status: 'disabled',
        message: 'AI auto-reply is disabled in settings',
      })
    }

    // Check if FastGPT is configured
    if (!settings.fastgptUrl || !settings.fastgptAppId || !settings.fastgptApiKey) {
      return NextResponse.json({
        status: 'misconfigured',
        message: 'FastGPT is not properly configured',
        config: {
          hasUrl: !!settings.fastgptUrl,
          hasAppId: !!settings.fastgptAppId,
          hasApiKey: !!settings.fastgptApiKey,
        },
      }, { status: 500 })
    }

    // Test FastGPT connection with a simple ping
    const fastgptUrl = settings.fastgptUrl.endsWith('/')
      ? `${settings.fastgptUrl}api/v1/chat/completions`
      : `${settings.fastgptUrl}/api/v1/chat/completions`

    try {
      const response = await fetch(fastgptUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.fastgptApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: 'health-check',
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          detail: false,
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (response.ok) {
        return NextResponse.json({
          status: 'healthy',
          message: 'FastGPT is reachable and responding',
          config: {
            fastgptUrl: settings.fastgptUrl,
            model: settings.model,
          },
        })
      } else {
        const errorText = await response.text()
        return NextResponse.json({
          status: 'error',
          message: `FastGPT returned HTTP ${response.status}`,
          details: errorText.substring(0, 200), // Truncate error
        }, { status: 500 })
      }
    } catch (fetchError: any) {
      // Network or timeout error
      return NextResponse.json({
        status: 'unreachable',
        message: 'Failed to connect to FastGPT service',
        details: fetchError.message,
        config: {
          fastgptUrl: settings.fastgptUrl,
        },
      }, { status: 503 })
    }
  } catch (error: any) {
    console.error('[AI Health Check] Error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      details: error.message,
    }, { status: 500 })
  }
}
