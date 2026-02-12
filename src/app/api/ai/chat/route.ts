import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readAISettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'
import { aiProviders } from '@/lib/ai/providers'
import { createStreamResponse } from '@/lib/ai/stream-helpers'

const ChatRequestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  stream: z.boolean().optional(),
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const log = getApiLogger('AIChatAPI', request)
  const startedAt = Date.now()

  try {
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      log.warning('Invalid request body', { errors: parsed.error.errors })
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const settings = readAISettings()

    if (!settings.enabled) {
      log.warning('AI chat is disabled')
      return NextResponse.json({ success: false, error: 'AI chat is disabled' }, { status: 403 })
    }

    const provider = aiProviders[settings.provider]
    if (!provider) {
      log.error('Unknown provider', { provider: settings.provider })
      return NextResponse.json({ success: false, error: 'Unknown AI provider' }, { status: 500 })
    }

    const { conversationId, message, history, stream } = parsed.data

    log.info('Chat request', {
      provider: settings.provider,
      conversationId,
      messageLength: message.length,
      historyLength: history?.length || 0,
      stream: !!stream,
    })

    const chatRequest = {
      conversationId,
      message,
      history,
    }

    if (stream && 'chatStream' in provider && typeof provider.chatStream === 'function') {
      const streamResult = await provider.chatStream(chatRequest, settings)

      log.info('Chat stream response', {
        provider: settings.provider,
        success: streamResult.success,
        latencyMs: Date.now() - startedAt,
      })

      if (!streamResult.success || !streamResult.data?.stream) {
        return NextResponse.json({ success: false, error: streamResult.error || 'Failed to get AI response' }, { status: 500 })
      }

      return createStreamResponse(streamResult.data.stream)
    }

    const result = await provider.chat(chatRequest, settings)

    log.info('Chat response', {
      provider: settings.provider,
      success: result.success,
      latencyMs: Date.now() - startedAt,
      responseLength: result.data?.message?.length,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    log.error('AI chat error', {
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
