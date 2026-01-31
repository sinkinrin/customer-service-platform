/**
 * Yuxi-Know Agents Proxy API
 *
 * POST /api/admin/settings/ai/agents - Fetches available agents from a Yuxi-Know server
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'

const RequestSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    }, 'Only http(s) URLs are allowed')
    .refine((value) => {
      const parsed = new URL(value)
      return !parsed.username && !parsed.password
    }, 'URL must not include credentials'),
  apiKey: z.string().min(1).max(512),
})

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors)
    }

    const { url, apiKey } = parsed.data
    const normalizedBaseUrl = url.replace(/\/+$/, '')
    const agentsUrl = `${normalizedBaseUrl}/api/v1/agents`

    const response = await fetch(agentsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return errorResponse(
        'UPSTREAM_ERROR',
        `Failed to fetch agents (${response.status})`,
        {
          upstreamStatus: response.status,
          upstreamBodyPreview: errorText.slice(0, 200),
        },
        502
      )
    }

    const data = await response.json()
    return successResponse({ agents: data.agents || [] })
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return unauthorizedResponse('You must be logged in')
    }
    if (err.message === 'Forbidden') {
      return forbiddenResponse('Admin access required')
    }
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return serverErrorResponse('Connection timeout', 'Request timed out after 10 seconds')
    }
    return serverErrorResponse('Failed to fetch agents', err.message)
  }
}
