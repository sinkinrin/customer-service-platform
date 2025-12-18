/**
 * Ticket 统计 API
 * 返回工单趋势数据，支持时间范围选择
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    serverErrorResponse,
    unauthorizedResponse,
} from '@/lib/utils/api-response'
import { subDays, format } from 'date-fns'

interface TicketTrendData {
    date: string
    new: number
    open: number
    closed: number
}

// Generate mock trend data for demo
function generateMockTrendData(days: number): TicketTrendData[] {
    const data: TicketTrendData[] = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
        const date = subDays(now, i)
        data.push({
            date: format(date, 'yyyy-MM-dd'),
            new: Math.floor(Math.random() * 20) + 5,
            open: Math.floor(Math.random() * 15) + 3,
            closed: Math.floor(Math.random() * 18) + 4,
        })
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

        // Generate mock data for demo
        // In production, this would query Zammad API for actual ticket data
        const trendData = generateMockTrendData(days)

        // Calculate summary stats
        const summary = {
            totalNew: trendData.reduce((sum, d) => sum + d.new, 0),
            totalOpen: trendData.reduce((sum, d) => sum + d.open, 0),
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
        console.error('[Stats Tickets API] Error:', error)
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        return serverErrorResponse('Failed to fetch ticket statistics', error.message)
    }
}
