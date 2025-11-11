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
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'

// Helper function to ensure user exists in Zammad
async function ensureZammadUser(email: string, fullName: string, role: string, region?: string) {
  try {
    // Try to search for user by email
    const searchResult = await zammadClient.searchUsers(`email:${email}`)
    if (searchResult && searchResult.length > 0) {
      console.log('[DEBUG] User already exists in Zammad:', searchResult[0].id)
      return searchResult[0]
    }

    // User doesn't exist, create them
    console.log('[DEBUG] Creating new user in Zammad:', email)
    const [firstname, ...lastnameArr] = fullName.split(' ')
    const lastname = lastnameArr.join(' ') || firstname

    // Determine Zammad roles
    let zammadRoles: string[]
    if (role === 'admin') {
      zammadRoles = ['Admin', 'Agent']
    } else if (role === 'staff') {
      zammadRoles = ['Agent']
    } else {
      zammadRoles = ['Customer']
    }

    // Prepare group_ids for staff (assign to region group)
    let groupIds: Record<string, string[]> | undefined
    if (role === 'staff' && region) {
      const groupId = getGroupIdByRegion(region as RegionValue)
      groupIds = {
        [groupId.toString()]: ['full']  // Full permission for staff in their region
      }
      console.log('[DEBUG] Setting group_ids for staff user:', groupIds)
    }

    const newUser = await zammadClient.createUser({
      login: email,
      email,
      firstname,
      lastname,
      roles: zammadRoles,
      group_ids: groupIds,
      active: true,
      verified: true,
    })

    console.log('[DEBUG] Created new Zammad user:', newUser.id)
    return newUser
  } catch (error) {
    console.error('[ERROR] Failed to ensure Zammad user:', error)
    throw error
  }
}

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

    // Ensure user exists in Zammad before searching (for non-admin users)
    if (user.role !== 'admin') {
      await ensureZammadUser(user.email, user.full_name, user.role, user.region)
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

