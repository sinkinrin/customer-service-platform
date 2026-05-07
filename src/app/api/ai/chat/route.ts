import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readAISettings, resolveAIChatSettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'
import { aiProviders } from '@/lib/ai/providers'
import { createStreamResponse } from '@/lib/ai/stream-helpers'
import { requireAuth } from '@/lib/utils/auth'
import { aiChatLimiter } from '@/lib/utils/rate-limit'

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
  mode: z.enum(['flash', 'pro']).optional().default('flash'),
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const log = getApiLogger('AIChatAPI', request)
  const startedAt = Date.now()

  try {
    // Explicit auth: direct AI chat supports authenticated customers and staff.
    const user = await requireAuth()

    // Rate limiting (H7+M11)
    const rateLimitKey = `ai-chat:${user.id}`
    const { allowed, resetAt } = aiChatLimiter.check(rateLimitKey)
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
      )
    }

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

    const { conversationId, message, history, stream, mode } = parsed.data
    const chatSettings = resolveAIChatSettings(settings, mode)

    log.info('Chat request', {
      provider: settings.provider,
      mode,
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
      const streamResult = await provider.chatStream(chatRequest, chatSettings)

      log.info('Chat stream response', {
        provider: settings.provider,
        mode,
        success: streamResult.success,
        latencyMs: Date.now() - startedAt,
      })

      if (!streamResult.success || !streamResult.data?.stream) {
        return NextResponse.json({ success: false, error: streamResult.error || 'Failed to get AI response' }, { status: 500 })
      }

      return createStreamResponse(streamResult.data.stream)
    }

    const result = await provider.chat(chatRequest, chatSettings)

    log.info('Chat response', {
      provider: settings.provider,
      mode,
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    log.error('AI chat error', {
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
