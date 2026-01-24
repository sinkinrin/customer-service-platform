/**
 * Ticket 统计 API
 * 返回工单趋势数据，支持时间范围选择
 * 使用真实 Zammad 数据计算每日新增/关闭工单数
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    serverErrorResponse,
    unauthorizedResponse,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/utils/logger'
import { zammadClient } from '@/lib/zammad/client'
import { subDays, format, parseISO, startOfDay } from 'date-fns'

interface TicketTrendData {
    date: string
    new: number      // 当日新创建的工单数
    closed: number   // 当日关闭的工单数
}

/**
 * 根据工单数据计算每日趋势
 * @param tickets - Zammad 工单列表
 * @param days - 统计天数
 */
function calculateTrendData(tickets: any[], days: number): TicketTrendData[] {
    const now = new Date()
    const data: TicketTrendData[] = []
    
    // Initialize data for each day
    for (let i = days - 1; i >= 0; i--) {
        const date = subDays(now, i)
        data.push({
            date: format(date, 'yyyy-MM-dd'),
            new: 0,
            closed: 0,
        })
    }
    
    // Create a map for quick lookup
    const dateMap = new Map<string, TicketTrendData>()
    data.forEach(d => dateMap.set(d.date, d))
    
    // Count tickets by created_at and closed dates
    for (const ticket of tickets) {
        // Count new tickets by created_at
        if (ticket.created_at) {
            const createdDate = format(startOfDay(parseISO(ticket.created_at)), 'yyyy-MM-dd')
            const dayData = dateMap.get(createdDate)
            if (dayData) {
                dayData.new++
            }
        }
        
        // Count closed tickets by close_at or updated_at (if state is closed)
        // state_id: 4 = closed
        if (ticket.state_id === 4) {
            // Use close_at if available, otherwise use updated_at
            const closeDate = ticket.close_at || ticket.updated_at
            if (closeDate) {
                const closedDateStr = format(startOfDay(parseISO(closeDate)), 'yyyy-MM-dd')
                const dayData = dateMap.get(closedDateStr)
                if (dayData) {
                    dayData.closed++
                }
            }
        }
    }
    
    return data
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

        // Fetch real ticket data from Zammad
        const startDate = subDays(new Date(), days)
        
        // Use getAllTickets to fetch all tickets (not searchTickets which has query formatting issues)
        const allTickets = await zammadClient.getAllTickets(undefined, 20) // Up to 2000 tickets
        
        // Filter tickets to only include those within our date range
        const relevantTickets = allTickets.filter(ticket => {
            const createdAt = ticket.created_at ? new Date(ticket.created_at) : null
            const closedAt = ticket.close_at ? new Date(ticket.close_at) : 
                            (ticket.state_id === 4 && ticket.updated_at ? new Date(ticket.updated_at) : null)
            
            // Include if created within range OR closed within range
            const createdInRange = createdAt && createdAt >= startDate
            const closedInRange = closedAt && closedAt >= startDate
            
            return createdInRange || closedInRange
        })

        // Calculate trend data from real tickets
        const trendData = calculateTrendData(relevantTickets, days)

        // Calculate summary stats
        const summary = {
            totalNew: trendData.reduce((sum, d) => sum + d.new, 0),
            totalClosed: trendData.reduce((sum, d) => sum + d.closed, 0),
            avgNew: Math.round(trendData.reduce((sum, d) => sum + d.new, 0) / days),
            avgClosed: Math.round(trendData.reduce((sum, d) => sum + d.closed, 0) / days),
        }

        return successResponse({
            range,
            days,
            trend: trendData,
            summary,
        })
    } catch (error: any) {
        logger.error('StatsTickets', 'Failed to fetch ticket statistics', { data: { error: error instanceof Error ? error.message : error } })
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        return serverErrorResponse('Failed to fetch ticket statistics', error.message)
    }
}
