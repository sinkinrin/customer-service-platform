import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readAISettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'

const ChatRequestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
})

export async function POST(request: NextRequest) {
  const log = getApiLogger('AIChatAPI', request)
  const startedAt = Date.now()
  try {
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      log.warning('Invalid request body', {
        hasConversationId: typeof body?.conversationId === 'string',
        messageLength: typeof body?.message === 'string' ? body.message.length : undefined,
        historyLength: Array.isArray(body?.history) ? body.history.length : undefined,
      })
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { message, history = [] } = parsed.data

    // Get AI settings from persistent configuration
    const aiSettings = readAISettings()

    // Check if AI is enabled
    if (!aiSettings.enabled) {
      log.warning('AI chat is disabled')
      return NextResponse.json(
        { success: false, error: 'AI chat is disabled' },
        { status: 403 }
      )
    }

    // Check if FastGPT configuration exists
    if (!aiSettings.fastgptUrl || !aiSettings.fastgptAppId || !aiSettings.fastgptApiKey) {
      log.error('FastGPT is not configured', {
        hasFastgptUrl: !!aiSettings.fastgptUrl,
        hasFastgptAppId: !!aiSettings.fastgptAppId,
        hasFastgptApiKey: !!aiSettings.fastgptApiKey,
      })
      return NextResponse.json(
        { success: false, error: 'FastGPT is not configured' },
        { status: 500 }
      )
    }
    
    // Prepare messages for FastGPT
    const messages = [
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ]
    
    // Call FastGPT API
    const fastgptUrl = aiSettings.fastgptUrl.endsWith('/')
      ? `${aiSettings.fastgptUrl}api/v1/chat/completions`
      : `${aiSettings.fastgptUrl}/api/v1/chat/completions`

    log.info('FastGPT request', {
      conversationId: parsed.data.conversationId,
      messageLength: message.length,
      historyLength: history.length,
      stream: false,
    })

    const response = await fetch(fastgptUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.fastgptApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId: parsed.data.conversationId,
        stream: false,
        detail: false,
        messages,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error('FastGPT API error', {
        status: response.status,
        latencyMs: Date.now() - startedAt,
        errorPreview: errorText.slice(0, 200),
        errorLength: errorText.length,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to get AI response' },
        { status: 500 }
      )
    }

    const data = await response.json()

    // Extract AI response from FastGPT response
    // FastGPT returns OpenAI-compatible format
    const aiMessage = data.choices?.[0]?.message?.content || data.data || 'Sorry, I could not generate a response.'

    log.info('FastGPT response', {
      status: response.status,
      latencyMs: Date.now() - startedAt,
      model: aiSettings.model || 'FastGPT',
      responseLength: typeof aiMessage === 'string' ? aiMessage.length : undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        message: aiMessage,
        model: aiSettings.model || 'FastGPT',
      },
    })
  } catch (error) {
    log.error('AI chat error', {
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

