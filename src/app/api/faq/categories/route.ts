/**
 * FAQ Categories API
 *
 * GET /api/faq/categories - Get all FAQ categories from Zammad Knowledge Base
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import {
  successResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'

// ============================================================================
// GET /api/faq/categories
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'en'

    // Convert language code to Zammad locale format
    const locale = language.toLowerCase().replace('_', '-')

    // Get categories from Zammad Knowledge Base
    const result = await zammadClient.getKnowledgeBaseCategories(locale)

    return successResponse({
      categories: result.categories || [],
      total: result.categories?.length || 0,
      language,
    })
  } catch (error) {
    console.error('GET /api/faq/categories error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

