/**
 * Regional Statistics API
 * 
 * GET /api/admin/stats/regions - Get ticket statistics by region (Admin only)
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { REGIONS, getRegionByGroupId } from '@/lib/constants/regions'

export async function GET(_request: NextRequest) {
  try {
    // Verify admin permission
    await requireRole(['admin'])

    // Get all tickets from Zammad
    // Note: This uses admin client, not X-On-Behalf-Of
    const searchResult = await zammadClient.searchTickets('*', 1000)
    const allTickets = searchResult.tickets || []

    // Initialize region statistics
    const regionStats = REGIONS.map((region) => ({
      region: region.value,
      label: region.label,
      labelEn: region.labelEn,
      total: 0,
      open: 0,
      closed: 0,
      waiting: 0,
    }))

    // Add "Unassigned" category for tickets in Users group (group_id = 1)
    const unassignedStats = {
      region: 'unassigned',
      label: '未分配 (Unassigned)',
      labelEn: 'Unassigned',
      total: 0,
      open: 0,
      closed: 0,
      waiting: 0,
    }

    // Count tickets by region
    allTickets.forEach((ticket: any) => {
      if (!ticket.group_id) return

      const region = getRegionByGroupId(ticket.group_id)
      
      // If no region mapping (e.g., group_id = 1 Users group), count as unassigned
      const stat = region 
        ? regionStats.find((s) => s.region === region)
        : unassignedStats

      if (!stat) return

      stat.total++

      // Count by status
      if (ticket.state_id === 1) {
        stat.waiting++
      } else if (ticket.state_id === 2) {
        stat.open++
      } else if (ticket.state_id === 4) {
        stat.closed++
      }
    })

    // Add unassigned stats if there are any unassigned tickets
    const allRegionStats = unassignedStats.total > 0 
      ? [...regionStats, unassignedStats]
      : regionStats

    return successResponse({
      regions: allRegionStats,
      total: searchResult.tickets_count || allTickets.length,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    console.error('Failed to fetch regional statistics:', error)
    return serverErrorResponse('Failed to fetch regional statistics', error.message)
  }
}

