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
import { getApiLogger, createApiLogger } from '@/lib/utils/api-logger'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'
import { mapStateIdToString } from '@/lib/constants/zammad-states'
import { checkZammadHealth, getZammadUnavailableMessage, isZammadUnavailableError } from '@/lib/zammad/health-check'
import { getVerifiedZammadUser, setVerifiedZammadUser } from '@/lib/cache/zammad-user-cache'
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'
import { filterTicketsByPermission, type AuthUser as PermissionUser, type Ticket as PermissionTicket } from '@/lib/utils/permission'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map priority_id to priority string for frontend compatibility
 */
function mapPriorityIdToString(priorityId: number): string {
  switch (priorityId) {
    case 1:
      return '1 low'
    case 2:
      return '2 normal'
    case 3:
      return '3 high'
    default:
      return '2 normal' // Default to normal if unknown
  }
}

// mapStateIdToString is now imported from @/lib/constants/zammad-states

/**
 * Transform Zammad ticket to include priority, state, and customer information
 */
function transformTicket(ticket: RawZammadTicket, customerInfo?: { name?: string; email?: string }) {
  return {
    ...ticket,
    priority: mapPriorityIdToString(ticket.priority_id),
    state: mapStateIdToString(ticket.state_id),
    customer: customerInfo?.name || customerInfo?.email || `Customer #${ticket.customer_id}`,
    customer_email: customerInfo?.email,
  }
}

const VALID_STATUS = new Set(['open', 'closed', 'new', 'pending'])
const VALID_SORT = new Set(['created_at', 'updated_at', 'priority'])
const VALID_ORDER = new Set(['asc', 'desc'])
const VALID_QUERY_MODE = new Set(['auto', 'keyword', 'dsl'])

type QueryMode = 'auto' | 'keyword' | 'dsl'

function getStatusSearchQuery(status?: string | null): string | null {
  if (!status) return null
  if (status === 'open') return '(state_id:1 OR state_id:2)'
  if (status === 'closed') return 'state_id:4'
  if (status === 'new') return 'state_id:1'
  if (status === 'pending') return '(state_id:3 OR state_id:7)'
  return null
}

function mapSortField(sort: string): string {
  if (sort === 'updated_at') return 'updated_at'
  if (sort === 'priority') return 'priority_id'
  return 'created_at'
}

function mapSortOrder(order: string): 'asc' | 'desc' {
  return order === 'asc' ? 'asc' : 'desc'
}

function buildKeywordQuery(rawQuery: string): string | null {
  const trimmed = rawQuery.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    return `number:${trimmed}`
  }

  return `title:*${trimmed}*`
}

function isDslLikeQuery(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  return trimmed.includes(':') || /\b(AND|OR|NOT)\b|\(|\)/i.test(trimmed)
}

function getBaseQuery(rawQuery: string, queryMode: QueryMode): string | null {
  const trimmed = rawQuery.trim()

  if (queryMode === 'keyword') {
    return buildKeywordQuery(trimmed)
  }

  if (queryMode === 'dsl') {
    return trimmed || null
  }

  // auto mode: preserve backward compatibility for existing DSL callers.
  if (!trimmed) return null
  if (isDslLikeQuery(trimmed)) return trimmed
  return buildKeywordQuery(trimmed)
}

function buildSearchQuery(options: {
  rawQuery: string
  queryMode: QueryMode
  status?: string | null
  priority?: number
  groupId?: number
  staffConstraint?: string | null
}): string {
  const parts: string[] = []
  const baseQuery = getBaseQuery(options.rawQuery, options.queryMode)
  const statusQuery = getStatusSearchQuery(options.status)

  if (baseQuery) {
    parts.push(baseQuery)
  }
  if (statusQuery) {
    parts.push(statusQuery)
  }
  if (options.priority) {
    parts.push(`priority_id:${options.priority}`)
  }
  if (options.groupId) {
    parts.push(`group_id:${options.groupId}`)
  }
  if (options.staffConstraint) {
    parts.push(options.staffConstraint)
  }

  if (parts.length === 0) {
    return 'state:*'
  }

  return parts.join(' AND ')
}

function buildStaffVisibilityQuery(user: PermissionUser): string | null {
  const clauses: string[] = []

  if (typeof user.zammad_id === 'number') {
    clauses.push(`owner_id:${user.zammad_id}`)
  }

  const groupIds = (user.group_ids || []).filter((id): id is number => Number.isFinite(id))
  if (groupIds.length === 1) {
    clauses.push(`group_id:${groupIds[0]}`)
  } else if (groupIds.length > 1) {
    clauses.push(`group_id:(${groupIds.join(' OR ')})`)
  }

  if (clauses.length === 0) {
    return null
  }

  return `(${clauses.join(' OR ')}) AND NOT owner_id:null AND NOT owner_id:0 AND NOT owner_id:1`
}

// Helper function to ensure user exists in Zammad
async function ensureZammadUser(email: string, fullName: string, role: string, region?: string, requestId?: string) {
  const log = createApiLogger('TicketSearchAPI', requestId)
  try {
    // Try to search for user by email
    const searchResult = await zammadClient.searchUsers(`email:${email}`)
    if (searchResult && searchResult.length > 0) {
      log.debug('User already exists in Zammad', { userId: searchResult[0].id })
      return searchResult[0]
    }

    // User doesn't exist, create them
    log.debug('Creating new user in Zammad', { email })
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
      log.debug('Setting group_ids for staff user', { groupIds })
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

    log.debug('Created new Zammad user', { userId: newUser.id })
    return newUser
  } catch (error) {
    log.error('Failed to ensure Zammad user', { error: error instanceof Error ? error.message : error })
    throw error
  }
}

// ============================================================================
// GET /api/tickets/search
// ============================================================================

export async function GET(request: NextRequest) {
  const log = getApiLogger('TicketSearchAPI', request)
  try {
    const user = await requireAuth()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const rawQuery = (searchParams.get('query') || '').trim()
    const queryModeRaw = searchParams.get('queryMode') || 'auto'
    const status = searchParams.get('status')
    const priorityRaw = searchParams.get('priority')
    const groupIdRaw = searchParams.get('group_id')
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '10')
    const page = parseInt(searchParams.get('page') || '1')

    // Validate pagination
    if (!Number.isFinite(limit) || limit < 1 || limit > 200) {
      return errorResponse('INVALID_LIMIT', 'Limit must be between 1 and 200', undefined, 400)
    }
    if (!Number.isFinite(page) || page < 1) {
      return errorResponse('INVALID_PAGE', 'Page must be greater than or equal to 1', undefined, 400)
    }

    if (!VALID_QUERY_MODE.has(queryModeRaw)) {
      return errorResponse('INVALID_QUERY_MODE', 'queryMode must be one of: auto, keyword, dsl', undefined, 400)
    }
    const queryMode = queryModeRaw as QueryMode

    // Validate filter and sort parameters
    if (status && !VALID_STATUS.has(status)) {
      return errorResponse('INVALID_STATUS', 'Status must be one of: open, closed, new, pending', undefined, 400)
    }

    let priority: number | undefined
    if (priorityRaw) {
      if (!/^\d+$/.test(priorityRaw)) {
        return errorResponse('INVALID_PRIORITY', 'priority must be an integer between 1 and 3', undefined, 400)
      }
      const parsedPriority = Number(priorityRaw)
      if (parsedPriority < 1 || parsedPriority > 3) {
        return errorResponse('INVALID_PRIORITY', 'priority must be an integer between 1 and 3', undefined, 400)
      }
      priority = parsedPriority
    }

    let groupId: number | undefined
    if (groupIdRaw) {
      if (!/^\d+$/.test(groupIdRaw)) {
        return errorResponse('INVALID_GROUP_ID', 'group_id must be a positive integer', undefined, 400)
      }
      const parsedGroupId = Number(groupIdRaw)
      if (parsedGroupId < 1) {
        return errorResponse('INVALID_GROUP_ID', 'group_id must be a positive integer', undefined, 400)
      }
      groupId = parsedGroupId
    }

    if (!VALID_SORT.has(sort)) {
      return errorResponse('INVALID_SORT', 'sort must be one of: created_at, updated_at, priority', undefined, 400)
    }
    if (!VALID_ORDER.has(order)) {
      return errorResponse('INVALID_ORDER', 'order must be one of: asc, desc', undefined, 400)
    }

    const sortBy = mapSortField(sort)
    const orderBy = mapSortOrder(order)

    // Check Zammad health before proceeding
    const healthCheck = await checkZammadHealth()
    if (!healthCheck.isHealthy) {
      log.warning('Zammad service unavailable', { error: healthCheck.error })
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    // Ensure user exists in Zammad before searching (for non-admin users)
    // Use cache to skip redundant verification calls
    if (user.role !== 'admin') {
      const cachedUserId = getVerifiedZammadUser(user.email, user.role, user.region)
      if (cachedUserId) {
        log.debug('Zammad user verified from cache', { userId: cachedUserId })
      } else {
        try {
          const zammadUser = await ensureZammadUser(user.email, user.full_name, user.role, user.region, log.requestId)
          if (zammadUser?.id) {
            setVerifiedZammadUser(user.email, user.role, zammadUser.id, user.region)
            log.debug('Zammad user verified and cached', { userId: zammadUser.id })
          }
        } catch (error) {
          log.warning('Failed to ensure Zammad user', { error: error instanceof Error ? error.message : error })
          // Continue anyway, search might still work
        }
      }
    }

    // Admin users search all tickets, other users search only their tickets
    log.debug('Search API - Raw query', { rawQuery })
    log.debug('Search API - User role', { role: user.role })
    log.debug('Search API - Filters', { limit, page, queryMode, status, priority, groupId, sortBy, orderBy })

    let result
    let total = 0
    if (user.role === 'admin') {
      // Admin: Search all tickets without X-On-Behalf-Of
      const effectiveQuery = buildSearchQuery({
        rawQuery,
        queryMode,
        status,
        priority,
        groupId,
      })
      log.debug('Search API - Calling searchTickets for admin', { effectiveQuery })
      const [searchResult, count] = await Promise.all([
        zammadClient.searchTicketsRawQuery(effectiveQuery, limit, undefined, page, sortBy, orderBy),
        zammadClient.searchTicketsTotalCountRawQuery(effectiveQuery),
      ])
      result = searchResult
      total = count
      log.debug('Search API - Result', { result: JSON.stringify(result, null, 2) })
    } else if (user.role === 'customer') {
      // Customer: Search tickets on behalf of user (only their own tickets)
      const effectiveQuery = buildSearchQuery({
        rawQuery,
        queryMode,
        status,
        priority,
        groupId,
      })
      log.debug('Search API - Calling searchTickets for customer', { email: user.email, effectiveQuery })
      const [searchResult, count] = await Promise.all([
        zammadClient.searchTicketsRawQuery(effectiveQuery, limit, user.email, page, sortBy, orderBy),
        zammadClient.searchTicketsTotalCountRawQuery(effectiveQuery, user.email),
      ])
      result = searchResult
      total = count
      log.debug('Search API - Result', { result: JSON.stringify(result, null, 2) })
    } else {
      const permissionUser: PermissionUser = {
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'staff' | 'customer',
        zammad_id: user.zammad_id,
        group_ids: user.group_ids,
        region: user.region,
      }
      const staffConstraint = buildStaffVisibilityQuery(permissionUser)
      if (!staffConstraint) {
        return successResponse({ tickets: [], total: 0, query: rawQuery, queryMode, limit, page })
      }

      const scopedQuery = buildSearchQuery({
        rawQuery,
        queryMode,
        status,
        priority,
        groupId,
        staffConstraint,
      })

      log.debug('Search API - Calling scoped search for staff', { scopedQuery, page, limit })
      const [searchResult, count] = await Promise.all([
        zammadClient.searchTicketsRawQuery(scopedQuery, limit, undefined, page, sortBy, orderBy),
        zammadClient.searchTicketsTotalCountRawQuery(scopedQuery),
      ])
      result = searchResult
      total = count
      log.debug('Search API - Before permission filter', { ticketCount: result.tickets?.length || 0, total })

      // Apply unified permission filtering for staff (same as /api/tickets list)
      // This ensures consistent filtering between list and search APIs
      if (result.tickets) {
        result.tickets = filterTicketsByPermission(result.tickets as unknown as PermissionTicket[], permissionUser) as unknown as typeof result.tickets
      }
      log.debug('Search API - After permission filter', { ticketCount: result.tickets?.length || 0 })
    }

    log.debug('Search API - Returning tickets count', { count: result.tickets?.length || 0 })

    // Collect unique customer IDs (to avoid duplicate fetches)
    const tickets = result.tickets || []
    const customerIds = [...new Set(tickets.map((t: any) => t.customer_id))]

    // In-memory cache for this request to avoid duplicate fetches
    const customerMap = new Map<number, { name?: string; email?: string }>()

    // Optimization: Fetch customers in parallel using efficient batch method
    // Increased concurrency to 50 for faster loading
    const CONCURRENCY_LIMIT = 50

    try {
      const customers = await zammadClient.getUsersByIds(customerIds, CONCURRENCY_LIMIT)

      // Populate customer map
      for (const customer of customers) {
        const name = customer.firstname && customer.lastname
          ? `${customer.firstname} ${customer.lastname}`.trim()
          : customer.firstname || customer.lastname || undefined
        customerMap.set(customer.id, {
          name,
          email: customer.email,
        })
      }
    } catch (error) {
      log.error('Error in parallel customer fetching', { error: error instanceof Error ? error.message : error })
      // Continue even if fetch fails
    }

    // Transform tickets to include priority, state, and customer information
    const transformedTickets = tickets.map((ticket: any) =>
      transformTicket(ticket, customerMap.get(ticket.customer_id))
    )

    return successResponse({
      tickets: transformedTickets,
      total,
      query: rawQuery,
      queryMode,
      limit,
      page,
    })
  } catch (error) {
    log.error('GET /api/tickets/search error', { error: error instanceof Error ? error.message : error })

    // Check if error is authentication error
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    // Check if error is due to Zammad being unavailable
    if (isZammadUnavailableError(error)) {
      return serverErrorResponse(
        getZammadUnavailableMessage(),
        { service: 'zammad', available: false },
        503
      )
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to search tickets')
  }
}
