/**
 * Tickets API
 * 
 * GET  /api/tickets - Get all tickets
 * POST /api/tickets - Create a new ticket
 */

import { NextRequest } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { filterTicketsByRegion, validateTicketCreation } from '@/lib/utils/region-auth'
import { getGroupIdByRegion, type RegionValue } from '@/lib/constants/regions'
import { z } from 'zod'

// Helper function to ensure user exists in Zammad
async function ensureZammadUser(email: string, fullName: string, role: string) {
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

    const newUser = await zammadClient.createUser({
      login: email,
      email,
      firstname,
      lastname,
      roles: zammadRoles,
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
// Validation Schemas
// ============================================================================

const createTicketSchema = z.object({
  title: z.string().min(1).max(255),
  group: z.string().min(1).optional().default('Support'),
  priority_id: z.number().int().min(1).max(4).optional().default(2),
  region: z.string().optional(), // Optional region override (defaults to user's region)
  article: z.object({
    subject: z.string().min(1),
    body: z.string().min(1),
    type: z.enum(['note', 'email', 'phone', 'web']).default('note'),
    internal: z.boolean().default(false),
  }),
})

// ============================================================================
// GET /api/tickets
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // open, closed, etc.
    const limit = parseInt(searchParams.get('limit') || '50')

    // Admin users get all tickets, other users get only their tickets
    let tickets
    if (user.role === 'admin') {
      // Admin: Get all tickets without X-On-Behalf-Of
      tickets = await zammadClient.getTickets()
    } else {
      // Customer/Staff: Get tickets on behalf of user
      tickets = await zammadClient.getTickets(user.email)
    }

    // Filter by region (staff can only see their region, admin sees all)
    let filteredTickets = filterTicketsByRegion(tickets, user)

    // Filter by status if provided
    if (status) {
      filteredTickets = filteredTickets.filter((ticket: any) => {
        if (status === 'open') return ticket.state_id === 2
        if (status === 'closed') return ticket.state_id === 4
        return true
      })
    }

    // Apply limit
    const limitedTickets = filteredTickets.slice(0, limit)

    return successResponse({
      tickets: limitedTickets,
      total: filteredTickets.length,
    })
  } catch (error) {
    console.error('GET /api/tickets error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ============================================================================
// POST /api/tickets
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Parse and validate request body
    const body = await request.json()
    console.log('[DEBUG] POST /api/tickets - Request body:', JSON.stringify(body, null, 2))
    console.log('[DEBUG] POST /api/tickets - User:', JSON.stringify(user, null, 2))

    const validationResult = createTicketSchema.safeParse(body)

    if (!validationResult.success) {
      console.error('[ERROR] POST /api/tickets - Validation failed:', validationResult.error.errors)
      return validationErrorResponse(validationResult.error.errors)
    }

    const ticketData = validationResult.data

    // Determine region (use provided region or user's region, default to 'asia-pacific' for admin)
    const region = (ticketData.region || user.region || 'asia-pacific') as RegionValue
    console.log('[DEBUG] POST /api/tickets - Determined region:', region)

    // Validate user has permission to create ticket in this region
    try {
      validateTicketCreation(user, region)
    } catch (error) {
      console.error('[ERROR] POST /api/tickets - Permission validation failed:', error)
      return validationErrorResponse([{
        path: ['region'],
        message: error instanceof Error ? error.message : 'Permission denied'
      }])
    }

    // Get Zammad group ID for the region
    const groupId = getGroupIdByRegion(region)
    console.log('[DEBUG] POST /api/tickets - Group ID for region:', groupId)

    // Ensure user exists in Zammad before creating ticket
    const zammadUser = await ensureZammadUser(user.email, user.full_name, user.role)
    console.log('[DEBUG] POST /api/tickets - Zammad user ID:', zammadUser.id)

    // Create ticket (using admin token, customer field will set the owner)
    const ticket = await zammadClient.createTicket({
      title: ticketData.title,
      group: ticketData.group,
      group_id: groupId, // Assign to region's group
      customer_id: zammadUser.id, // Use customer_id instead of customer email
      state_id: 2, // open
      priority_id: ticketData.priority_id,
      article: {
        subject: ticketData.article.subject,
        body: ticketData.article.body,
        type: ticketData.article.type,
        internal: ticketData.article.internal,
      },
    })

    console.log('[DEBUG] POST /api/tickets - Created ticket:', ticket.id)

    return successResponse(
      {
        ticket,
      },
      201
    )
  } catch (error) {
    console.error('POST /api/tickets error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

