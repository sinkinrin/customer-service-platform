/**
 * Ticket Search API
 * 
 * GET /api/tickets/search - Search tickets
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'

// ============================================================================
// GET /api/tickets/search
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!query) {
      return errorResponse('Query parameter is required', 400)
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return errorResponse('Limit must be between 1 and 100', 400)
    }

    // Admin users search all tickets, other users search only their tickets
    let result
    if (user.role === 'admin') {
      // Admin: Search all tickets without X-On-Behalf-Of
      result = await zammadClient.searchTickets(query, limit)
    } else {
      // Customer/Staff: Search tickets on behalf of user
      result = await zammadClient.searchTickets(query, limit, user.email)
    }

    return successResponse({
      tickets: result.tickets || [],
      total: result.tickets_count || 0,
      query,
      limit,
    })
  } catch (error) {
    console.error('GET /api/tickets/search error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

