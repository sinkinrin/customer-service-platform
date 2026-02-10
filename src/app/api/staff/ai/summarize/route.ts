/**
 * Staff AI Summarize API
 *
 * POST /api/staff/ai/summarize
 * Generate a concise summary of a ticket's conversation
 *
 * Security: Staff/Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/utils/auth'
import { readAISettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'
import { FastGPTProvider, OpenAICompatProvider, YuxiLegacyProvider } from '@/lib/ai/providers'

const SummarizeSchema = z.object({
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
  const log = getApiLogger('StaffAISummarize', request)
  const startedAt = Date.now()

  try {
    await requireRole(['staff', 'admin'])

    const body = await request.json()
    const parsed = SummarizeSchema.safeParse(body)

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

    // Build the full conversation for summarization
    const allMessages = articles
      .map(a => {
        const prefix = a.internal ? '[Internal Note] ' : ''
        return `${prefix}[${a.sender}${a.created_at ? ` - ${a.created_at}` : ''}]: ${a.body}`
      })
      .join('\n\n')

    const langHint = language ? `Respond in: ${language}.` : 'Respond in the same language as the conversation.'

    const prompt = `Summarize the following customer service ticket concisely.

Ticket: "${ticketTitle}"
${ticketState ? `Status: ${ticketState}` : ''}
${ticketPriority ? `Priority: ${ticketPriority}` : ''}
${customerName ? `Customer: ${customerName}` : ''}

Conversation:
${allMessages}

Provide a structured summary with:
1. **Issue**: What the customer's problem/request is (1-2 sentences)
2. **Key Points**: Important details from the conversation (bullet points)
3. **Current Status**: Where things stand now
4. **Suggested Next Step**: What the agent should do next

Keep it brief and actionable. ${langHint}`

    log.info('Generating ticket summary', {
      provider: settings.provider,
      ticketTitle,
      articlesCount: articles.length,
    })

    const result = await provider.chat(
      {
        conversationId: `staff-summary-${Date.now()}`,
        message: prompt,
        history: [],
      },
      settings
    )

    log.info('Summary response', {
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
        summary: result.data?.message || '',
        model: result.data?.model,
      },
    })
  } catch (error) {
    log.error('Summarize error', {
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
