/**
 * FAQ API
 *
 * GET /api/faq - Search FAQ items using Zammad Knowledge Base
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'

// ============================================================================
// GET /api/faq
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const language = searchParams.get('language') || 'en'
    const limit = parseInt(searchParams.get('limit') || '10')

    // Validate limit
    if (limit < 1 || limit > 50) {
      return errorResponse('Limit must be between 1 and 50', 400)
    }

    // Convert language code to Zammad locale format
    // en -> en, zh-CN -> zh-cn, etc.
    const locale = language.toLowerCase().replace('_', '-')

    // If no query, return empty results (Zammad KB requires search query)
    if (!query) {
      return successResponse({
        items: [],
        total: 0,
        type: 'popular',
        message: 'Please provide a search query',
      })
    }

    // Search Zammad Knowledge Base
    const results = await zammadClient.searchKnowledgeBase(query, locale, limit)

    return successResponse({
      items: results.result || [],
      total: results.total || 0,
      query,
      language,
    })
  } catch (error) {
    console.error('GET /api/faq error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

