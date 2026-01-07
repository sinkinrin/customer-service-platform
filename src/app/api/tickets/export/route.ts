import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { filterTicketsByRegion } from '@/lib/utils/region-auth'
import { getRegionByGroupId } from '@/lib/constants/regions'
import { getRegionLabelForLocale } from '@/lib/i18n/region-labels'
import { prisma } from '@/lib/prisma'
import type { ZammadTicket as RawZammadTicket } from '@/lib/zammad/types'

// Map state_id to readable status
function getStateName(stateId: number): string {
  const stateMap: Record<number, string> = {
    1: 'New',
    2: 'Open',
    3: 'Pending Reminder',
    4: 'Closed',
    5: 'Merged',
    6: 'Removed',
    7: 'Pending Close',
  }
  return stateMap[stateId] || `Unknown (${stateId})`
}

// Map priority_id to readable priority
function getPriorityName(priorityId: number): string {
  const priorityMap: Record<number, string> = {
    1: 'Low',
    2: 'Normal',
    3: 'High',
  }
  return priorityMap[priorityId] || `Unknown (${priorityId})`
}

// Escape CSV value
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If contains comma, newline, or quote, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Get region name from group_id
function getRegionName(groupId: number | undefined): string {
  if (!groupId) return 'Unknown'
  const region = getRegionByGroupId(groupId)
  if (!region) return 'Unknown'
  return getRegionLabelForLocale(region, 'en')
}

// Map rating to display text
function getRatingText(rating: string | null | undefined): string {
  if (!rating) return 'No Rating'
  return rating === 'positive' ? 'Satisfied' : 'Not Satisfied'
}

// GET /api/tickets/export - Export tickets to CSV
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Only staff and admin can export
    if (session.user.role === 'customer') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    console.log('[Export] Starting export for user:', session.user.email)

    // Get all tickets from Zammad
    let tickets: RawZammadTicket[] = await zammadClient.getAllTickets()
    console.log('[Export] Fetched', tickets.length, 'tickets from Zammad')

    // Staff can only export their region's tickets
    if (session.user.role === 'staff') {
      tickets = filterTicketsByRegion(tickets, session.user)
      console.log('[Export] After region filter:', tickets.length, 'tickets')
    }

    // Fetch customer and owner info for all tickets (with concurrency limit)
    const customerIds = [...new Set(tickets.map(t => t.customer_id))]
    const ownerIds = [...new Set(tickets.map(t => t.owner_id).filter(Boolean))] as number[]

    const customerMap = new Map<number, string>()
    const ownerMap = new Map<number, string>()

    // Fetch customer names (batch)
    for (const customerId of customerIds) {
      try {
        const customer = await zammadClient.getUser(customerId)
        const name = customer.firstname && customer.lastname
          ? `${customer.firstname} ${customer.lastname}`.trim()
          : customer.email || `Customer #${customerId}`
        customerMap.set(customerId, name)
      } catch {
        customerMap.set(customerId, `Customer #${customerId}`)
      }
    }

    // Fetch owner names (batch)
    for (const ownerId of ownerIds) {
      try {
        const owner = await zammadClient.getUser(ownerId)
        const name = owner.firstname && owner.lastname
          ? `${owner.firstname} ${owner.lastname}`.trim()
          : owner.email || `Staff #${ownerId}`
        ownerMap.set(ownerId, name)
      } catch {
        ownerMap.set(ownerId, `Staff #${ownerId}`)
      }
    }

    // Fetch customer satisfaction ratings from database
    const ratingMap = new Map<number, string>()
    try {
      const ticketIds = tickets.map(t => t.id)
      // Note: This will fail if prisma generate hasn't been run yet
      const ratings = await prisma.ticketRating?.findMany({
        where: { ticketId: { in: ticketIds } },
        select: { ticketId: true, rating: true },
      })
      if (ratings) {
        for (const r of ratings) {
          ratingMap.set(r.ticketId, r.rating)
        }
      }
      console.log('[Export] Loaded', ratingMap.size, 'ratings from database')
    } catch (error) {
      console.warn('[Export] Could not load ratings (table may not exist yet):', error)
      // Continue without ratings - will show "No Rating" for all
    }

    // Generate CSV with BOM for Excel UTF-8 support
    const BOM = '\uFEFF'
    const csvHeaders = [
      'Ticket ID',
      'Ticket Number',
      'Title',
      'Region',
      'Status',
      'Priority',
      'Customer',
      'Assigned To',
      'Customer Satisfaction',
      'Created At',
      'Updated At',
    ]

    const csvRows = tickets.map(ticket => [
      ticket.id,
      ticket.number,
      escapeCSV(ticket.title),
      getRegionName(ticket.group_id),
      getStateName(ticket.state_id),
      getPriorityName(ticket.priority_id),
      escapeCSV(customerMap.get(ticket.customer_id) || ''),
      escapeCSV(ticket.owner_id ? ownerMap.get(ticket.owner_id) || 'Unassigned' : 'Unassigned'),
      getRatingText(ratingMap.get(ticket.id)),
      ticket.created_at,
      ticket.updated_at,
    ].join(','))

    const csvContent = BOM + [csvHeaders.join(','), ...csvRows].join('\n')

    console.log('[Export] Generated CSV with', csvRows.length, 'rows')

    // Return as downloadable file
    const filename = `tickets-export-${new Date().toISOString().split('T')[0]}.csv`
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/tickets/export] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export tickets' } },
      { status: 500 }
    )
  }
}
