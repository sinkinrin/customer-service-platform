/**
 * Staff AI Chat API
 *
 * POST /api/staff/ai/chat
 * Internal knowledge Q&A for staff - can include ticket context
 *
 * Security: Staff/Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/utils/auth'
import { readAISettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'
import { aiProviders } from '@/lib/ai/providers'

const StaffChatSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  // Optional ticket context for context-aware answers
  ticketContext: z
    .object({
      ticketTitle: z.string(),
      customerName: z.string().optional(),
      articles: z
        .array(
          z.object({
            sender: z.string(),
            body: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  const log = getApiLogger('StaffAIChat', request)
  const startedAt = Date.now()

  try {
    await requireRole(['staff', 'admin'])

    const body = await request.json()
    const parsed = StaffChatSchema.safeParse(body)

    if (!parsed.success) {
      log.warning('Invalid request body', { errors: parsed.error.errors })
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const settings = readAISettings()

    if (!settings.enabled) {
      log.warning('AI is disabled')
      return NextResponse.json({ success: false, error: 'AI is disabled' }, { status: 403 })
    }

    const provider = aiProviders[settings.provider]
    if (!provider) {
      log.error('Unknown provider', { provider: settings.provider })
      return NextResponse.json({ success: false, error: 'Unknown AI provider' }, { status: 500 })
    }

    const { message, history, ticketContext } = parsed.data

    // Build context-enhanced message
    let contextPrefix = ''
    if (ticketContext) {
      const articlesSummary = ticketContext.articles
        ?.map(a => `[${a.sender}]: ${a.body}`)
        .join('\n')

      contextPrefix = `[Context: You are helping a customer service agent. They are currently handling a ticket titled "${ticketContext.ticketTitle}"${ticketContext.customerName ? ` from customer "${ticketContext.customerName}"` : ''}.${articlesSummary ? `\n\nRecent conversation:\n${articlesSummary}` : ''}\n\nThe agent's question:]\n\n`
    }

    const fullMessage = contextPrefix + message

    log.info('Staff AI chat request', {
      provider: settings.provider,
      messageLength: message.length,
      hasContext: !!ticketContext,
      historyLength: history?.length || 0,
    })

    const result = await provider.chat(
      {
        conversationId: `staff-chat-${Date.now()}`,
        message: fullMessage,
        history: history || [],
      },
      settings
    )

    log.info('Staff AI chat response', {
      success: result.success,
      latencyMs: Date.now() - startedAt,
      responseLength: result.data?.message?.length,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: result.data?.message || '',
        model: result.data?.model,
      },
    })
  } catch (error) {
    log.error('Staff AI chat error', {
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
