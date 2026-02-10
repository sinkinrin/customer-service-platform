/**
 * Staff AI Suggest Reply API
 *
 * POST /api/staff/ai/suggest-reply
 * Generate a reply draft based on ticket context (articles + customer info)
 *
 * Security: Staff/Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/utils/auth'
import { readAISettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'
import { FastGPTProvider, OpenAICompatProvider, YuxiLegacyProvider } from '@/lib/ai/providers'

const SuggestReplySchema = z.object({
  ticketTitle: z.string(),
  ticketState: z.string().optional(),
  ticketPriority: z.string().optional(),
  customerName: z.string().optional(),
  articles: z.array(
    z.object({
      sender: z.string(),
      body: z.string(),
      internal: z.boolean().optional(),
      created_at: z.string().optional(),
    })
  ),
  language: z.string().optional(),
})

const providers = {
  fastgpt: new FastGPTProvider(),
  openai: new OpenAICompatProvider(),
  'yuxi-legacy': new YuxiLegacyProvider(),
}

export async function POST(request: NextRequest) {
  const log = getApiLogger('StaffAISuggestReply', request)
  const startedAt = Date.now()

  try {
    await requireRole(['staff', 'admin'])

    const body = await request.json()
    const parsed = SuggestReplySchema.safeParse(body)

    if (!parsed.success) {
      log.warning('Invalid request body', { errors: parsed.error.errors })
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const settings = readAISettings()

    if (!settings.enabled) {
      log.warning('AI is disabled')
      return NextResponse.json({ success: false, error: 'AI is disabled' }, { status: 403 })
    }

    const provider = providers[settings.provider]
    if (!provider) {
      log.error('Unknown provider', { provider: settings.provider })
      return NextResponse.json({ success: false, error: 'Unknown AI provider' }, { status: 500 })
    }

    const { ticketTitle, ticketState, ticketPriority, customerName, articles, language } = parsed.data

    // Build conversation history from articles (exclude internal notes)
    const conversationHistory = articles
      .filter(a => !a.internal)
      .map(a => `[${a.sender}]: ${a.body}`)
      .join('\n\n')

    // Build the prompt for generating a staff reply
    const langHint = language ? `Respond in the same language as the customer. The UI language is: ${language}.` : 'Respond in the same language as the customer.'

    const systemContext = `You are an AI assistant helping a customer service agent draft a reply to a customer ticket.

Ticket: "${ticketTitle}"
${ticketState ? `Status: ${ticketState}` : ''}
${ticketPriority ? `Priority: ${ticketPriority}` : ''}
${customerName ? `Customer: ${customerName}` : ''}

Conversation history:
${conversationHistory}

Instructions:
- Draft a professional, helpful reply that the agent can send to the customer.
- Be concise but thorough. Address the customer's concerns directly.
- Use a friendly but professional tone.
- Do NOT include greetings like "Dear customer" - the agent will add their own style.
- Do NOT include signatures or closing remarks.
- Focus on solving the problem or answering the question.
- ${langHint}`

    log.info('Generating suggest-reply', {
      provider: settings.provider,
      ticketTitle,
      articlesCount: articles.length,
    })

    const result = await provider.chat(
      {
        conversationId: `staff-suggest-${Date.now()}`,
        message: systemContext,
        history: [],
      },
      settings
    )

    log.info('Suggest-reply response', {
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
        suggestedReply: result.data?.message || '',
        model: result.data?.model,
      },
    })
  } catch (error) {
    log.error('Suggest-reply error', {
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
