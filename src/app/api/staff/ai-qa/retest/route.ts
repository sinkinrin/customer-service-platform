/**
 * AI QA Retest API
 *
 * POST /api/staff/ai-qa/retest - Re-test an AI answer by sending the original
 * question to FastGPT using a dedicated retest API key.
 *
 * Rate limit: 5 per minute per user.
 * Body: { messageId: string }
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole, type AuthUser } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'
import { readAISettings } from '@/lib/utils/ai-config'
import { upsertRetestResult } from '@/lib/ai-qa/review-service'
import { findQuestionForAiMessage } from '@/lib/ai-qa/qa-pair-extractor'
import { FASTGPT_RETEST_TIMEOUT, RETEST_RATE_LIMIT } from '@/lib/ai-qa/constants'

const RetestSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
})

// Simple in-memory rate limiter: userId -> timestamps of recent calls
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowMs = 60_000
  let timestamps = rateLimitMap.get(userId) || []

  // Remove entries outside the window
  timestamps = timestamps.filter((t) => now - t < windowMs)
  rateLimitMap.set(userId, timestamps)

  if (timestamps.length >= RETEST_RATE_LIMIT) {
    return false
  }

  timestamps.push(now)
  return true
}

export async function POST(request: NextRequest) {
  let user: AuthUser
  try {
    user = await requireRole(['staff', 'admin'])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Authentication failed')
  }

  try {
    const body = await request.json()
    const parsed = RetestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid request', parsed.error.flatten().fieldErrors, 400)
    }

    const { messageId } = parsed.data

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      return errorResponse(
        'RATE_LIMITED',
        `Rate limit exceeded. Maximum ${RETEST_RATE_LIMIT} retests per minute.`,
        undefined,
        429
      )
    }

    // Fetch the AI message
    const aiMessage = await prisma.aiMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        content: true,
        senderRole: true,
        conversationId: true,
        createdAt: true,
      },
    })

    if (!aiMessage || aiMessage.senderRole !== 'ai') {
      return notFoundResponse('AI message not found')
    }

    // Fetch conversation messages to extract the original question
    const convMessages = await prisma.aiMessage.findMany({
      where: { conversationId: aiMessage.conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        conversationId: true,
        senderRole: true,
        content: true,
        createdAt: true,
      },
    })

    const question = findQuestionForAiMessage(messageId, convMessages)
    if (!question) {
      return errorResponse(
        'NO_QUESTION',
        'Could not find the original customer question for this AI message',
        undefined,
        400
      )
    }

    // Build independent AISettings with retest API key
    const baseSettings = readAISettings()
    const retestApiKey = process.env.AI_QA_RETEST_KEY
    if (!retestApiKey) {
      return errorResponse(
        'CONFIG_ERROR',
        'Retest API key is not configured (AI_QA_RETEST_KEY)',
        undefined,
        503
      )
    }

    const retestAppId = baseSettings.qaRetestAppId || baseSettings.fastgptAppId
    const retestSettings = {
      ...baseSettings,
      fastgptApiKey: retestApiKey,
      fastgptAppId: retestAppId,
    }

    // Call FastGPT directly with AbortSignal.timeout for real timeout enforcement
    const chatId = `retest-${new Date().toISOString().split('T')[0]}-${messageId.slice(0, 8)}`
    const fastgptUrl = retestSettings.fastgptUrl.endsWith('/')
      ? `${retestSettings.fastgptUrl}api/v1/chat/completions`
      : `${retestSettings.fastgptUrl}/api/v1/chat/completions`

    try {
      const response = await fetch(fastgptUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${retestApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          stream: false,
          detail: false,
          messages: [{ role: 'user', content: question }],
        }),
        signal: AbortSignal.timeout(FASTGPT_RETEST_TIMEOUT),
      })

      if (!response.ok) {
        const errText = await response.text()
        logger.error('AiQaRetest', 'FastGPT API error', { data: { status: response.status, error: errText.slice(0, 200) } })
        return errorResponse('RETEST_FAILED', 'Failed to get retest response from AI', undefined, 502)
      }

      const data = await response.json()
      const retestAnswer = data.choices?.[0]?.message?.content || data.data || ''

      if (!retestAnswer) {
        return errorResponse('RETEST_FAILED', 'AI returned empty response', undefined, 502)
      }

      // Save retest result
      await upsertRetestResult({
        messageId,
        retestAnswer,
        retestAppId: retestAppId || null,
      })

      logger.info('AiQaRetest', 'Retest completed', {
        data: { messageId, userId: user.id, retestAppId },
      })

      return successResponse({
        originalAnswer: aiMessage.content,
        retestAnswer,
        retestAppId: retestAppId || null,
        retestAt: new Date().toISOString(),
      })
    } catch (fetchError: unknown) {
      const fetchMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)

      if (fetchMessage.includes('abort') || fetchMessage.includes('timeout')) {
        logger.warn('AiQaRetest', 'Retest timed out', {
          data: { messageId, timeout: FASTGPT_RETEST_TIMEOUT },
        })
        return errorResponse('RETEST_TIMEOUT', 'Retest request timed out', undefined, 504)
      }
      throw fetchError
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('AiQaRetest', 'Failed to retest', {
      data: { error: message },
    })
    return serverErrorResponse('Failed to retest AI answer')
  }
}
