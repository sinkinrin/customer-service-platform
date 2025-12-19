/**
 * Ticket 统计 API
 * 返回工单趋势数据，支持时间范围选择
 * 
 * 使用真实的 Zammad 数据统计工单趋势
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    serverErrorResponse,
    unauthorizedResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { subDays, format, parseISO, startOfDay, endOfDay } from 'date-fns'

interface TicketTrendData {
    date: string
    new: number
    open: number
    closed: number
}

export async function GET(request: NextRequest) {
    try {
        await requireRole(['admin'])

        const { searchParams } = new URL(request.url)
        const range = searchParams.get('range') || '7d'

        // Determine number of days based on range
        let days = 7
        switch (range) {
            case '30d':
                days = 30
                break
            case '90d':
                days = 90
                break
            case '7d':
            default:
                days = 7
        }

        // Get all tickets from Zammad
        const allTickets = await zammadClient.getAllTickets()

        // Calculate date range
        const now = new Date()
        const startDate = startOfDay(subDays(now, days - 1))

        // Initialize daily counts
        const dailyCounts: Record<string, { new: number; open: number; closed: number }> = {}

        // Initialize all days with zero counts
        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(now, i)
            const dateKey = format(date, 'yyyy-MM-dd')
            dailyCounts[dateKey] = { new: 0, open: 0, closed: 0 }
        }

        // Process tickets and count by creation date
        for (const ticket of allTickets) {
            const createdDate = parseISO(ticket.created_at)

            // Only count tickets within the date range
            if (createdDate >= startDate) {
                const dateKey = format(createdDate, 'yyyy-MM-dd')

                if (dailyCounts[dateKey]) {
                    // Count as new on creation date
                    dailyCounts[dateKey].new++

                    // If ticket is open (state_id 2) or new (state_id 1), count as open
                    if ([1, 2, 3, 7].includes(ticket.state_id)) {
                        dailyCounts[dateKey].open++
                    }
                }
            }

            // Count closed tickets by close date or updated date
            if ([4, 5].includes(ticket.state_id)) {
                const closedDate = ticket.close_at
                    ? parseISO(ticket.close_at)
                    : parseISO(ticket.updated_at)

                if (closedDate >= startDate) {
                    const dateKey = format(closedDate, 'yyyy-MM-dd')
                    if (dailyCounts[dateKey]) {
                        dailyCounts[dateKey].closed++
                    }
                }
            }
        }

        // Convert to array format
        const trendData: TicketTrendData[] = []
        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(now, i)
            const dateKey = format(date, 'yyyy-MM-dd')
            const counts = dailyCounts[dateKey] || { new: 0, open: 0, closed: 0 }

            trendData.push({
                date: dateKey,
                new: counts.new,
                open: counts.open,
                closed: counts.closed,
            })
        }

        // Calculate summary stats
        const summary = {
            totalNew: trendData.reduce((sum, d) => sum + d.new, 0),
            totalOpen: trendData.reduce((sum, d) => sum + d.open, 0),
            totalClosed: trendData.reduce((sum, d) => sum + d.closed, 0),
            avgNew: Math.round(trendData.reduce((sum, d) => sum + d.new, 0) / days),
            avgClosed: Math.round(trendData.reduce((sum, d) => sum + d.closed, 0) / days),
            // Current overall status
            currentTotal: allTickets.length,
            currentOpen: allTickets.filter(t => [1, 2, 3, 7].includes(t.state_id)).length,
            currentClosed: allTickets.filter(t => [4, 5].includes(t.state_id)).length,
        }

        return successResponse({
            range,
            days,
            trend: trendData,
            summary,
            source: 'zammad', // Indicate real data source
        })
    } catch (error: any) {
        console.error('[Stats Tickets API] Error:', error)
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        return serverErrorResponse('Failed to fetch ticket statistics', error.message)
    }
}
