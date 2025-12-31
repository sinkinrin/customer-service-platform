/**
 * Unified Dashboard Stats API
 * Consolidates all dashboard data fetching into a single API call
 * to avoid redundant Zammad API calls and improve performance
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    serverErrorResponse,
    unauthorizedResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { REGIONS, getRegionByGroupId } from '@/lib/constants/regions'
import { getRegionLabelForLocale } from '@/lib/i18n/region-labels'
import { subDays, format, parseISO, startOfDay } from 'date-fns'

interface TicketStats {
    total: number
    open: number
    pending: number
    closed: number
}

interface RegionStats {
    region: string
    label: string
    labelEn: string
    total: number
    open: number
    closed: number
}

interface TrendData {
    date: string
    new: number
    closed: number
}

interface RecentActivity {
    id: string
    type: string
    ticketNumber: string
    title: string
    state: string
    timestamp: string
}

export async function GET(request: NextRequest) {
    try {
        await requireRole(['admin'])

        const { searchParams } = new URL(request.url)
        const trendRange = searchParams.get('trendRange') || '7d'

        // Determine trend days
        let trendDays = 7
        switch (trendRange) {
            case '30d': trendDays = 30; break
            case '90d': trendDays = 90; break
            default: trendDays = 7
        }

        // Fetch all data in parallel - but only ONE call to getAllTickets
        const [allTickets, allUsers] = await Promise.all([
            zammadClient.getAllTickets(undefined, 10), // Limit to 1000 tickets for performance
            zammadClient.searchUsers('*'),
        ])

        // Get today's date at midnight
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayTimestamp = today.getTime()

        // Calculate ticket stats
        const todayTickets = allTickets.filter((t: any) => {
            const createdDate = new Date(t.created_at)
            createdDate.setHours(0, 0, 0, 0)
            return createdDate.getTime() === todayTimestamp
        })

        const todayStats: TicketStats = {
            total: todayTickets.length,
            open: todayTickets.filter((t: any) => t.state_id === 1 || t.state_id === 2).length,
            pending: todayTickets.filter((t: any) => t.state_id === 3 || t.state_id === 7).length,
            closed: todayTickets.filter((t: any) => t.state_id === 4).length,
        }

        const allTimeStats: TicketStats = {
            total: allTickets.length,
            open: allTickets.filter((t: any) => t.state_id === 1 || t.state_id === 2).length,
            pending: allTickets.filter((t: any) => t.state_id === 3 || t.state_id === 7).length,
            closed: allTickets.filter((t: any) => t.state_id === 4).length,
        }

        // Calculate region stats
        const regionStatsMap = new Map<string, RegionStats>()
        REGIONS.forEach(region => {
            regionStatsMap.set(region.value, {
                region: region.value,
                label: getRegionLabelForLocale(region.value, 'zh-CN'),
                labelEn: getRegionLabelForLocale(region.value, 'en'),
                total: 0,
                open: 0,
                closed: 0,
            })
        })

        // Add unassigned category
        const unassignedStats: RegionStats = {
            region: 'unassigned',
            label: getRegionLabelForLocale('unassigned', 'zh-CN'),
            labelEn: getRegionLabelForLocale('unassigned', 'en'),
            total: 0,
            open: 0,
            closed: 0,
        }

        allTickets.forEach((ticket: any) => {
            if (!ticket.group_id) {
                unassignedStats.total++
                if (ticket.state_id === 1 || ticket.state_id === 2) unassignedStats.open++
                else if (ticket.state_id === 4) unassignedStats.closed++
                return
            }

            const region = getRegionByGroupId(ticket.group_id)
            if (region) {
                const stats = regionStatsMap.get(region)
                if (stats) {
                    stats.total++
                    if (ticket.state_id === 1 || ticket.state_id === 2) stats.open++
                    else if (ticket.state_id === 4) stats.closed++
                }
            }
        })

        const regionStats = Array.from(regionStatsMap.values())
        if (unassignedStats.total > 0) {
            regionStats.push(unassignedStats)
        }

        // Calculate trend data
        const trendStartDate = subDays(new Date(), trendDays)
        const trendData: TrendData[] = []

        for (let i = trendDays - 1; i >= 0; i--) {
            const date = subDays(new Date(), i)
            trendData.push({
                date: format(date, 'yyyy-MM-dd'),
                new: 0,
                closed: 0,
            })
        }

        const dateMap = new Map<string, TrendData>()
        trendData.forEach(d => dateMap.set(d.date, d))

        allTickets.forEach((ticket: any) => {
            // Count new tickets
            if (ticket.created_at) {
                const createdDate = format(startOfDay(parseISO(ticket.created_at)), 'yyyy-MM-dd')
                const dayData = dateMap.get(createdDate)
                if (dayData) dayData.new++
            }

            // Count closed tickets
            if (ticket.state_id === 4) {
                const closeDate = ticket.close_at || ticket.updated_at
                if (closeDate) {
                    const closedDateStr = format(startOfDay(parseISO(closeDate)), 'yyyy-MM-dd')
                    const dayData = dateMap.get(closedDateStr)
                    if (dayData) dayData.closed++
                }
            }
        })

        // Recent activities (last 10 updated tickets)
        const recentActivities: RecentActivity[] = [...allTickets]
            .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 10)
            .map((ticket: any) => ({
                id: ticket.id.toString(),
                type: 'ticket_updated',
                ticketNumber: ticket.number,
                title: ticket.title,
                state: getStateName(ticket.state_id),
                timestamp: ticket.updated_at,
            }))

        // User stats
        const totalUsers = allUsers.length

        return successResponse({
            ticketStats: {
                today: todayStats,
                allTime: allTimeStats,
            },
            regionStats,
            trendData,
            trendRange,
            recentActivities,
            totalUsers,
        })
    } catch (error: any) {
        console.error('[Dashboard Stats API] Error:', error)
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        return serverErrorResponse('Failed to fetch dashboard statistics', error.message)
    }
}

function getStateName(stateId: number): string {
    switch (stateId) {
        case 1: return 'new'
        case 2: return 'open'
        case 3: return 'pending reminder'
        case 4: return 'closed'
        case 7: return 'pending close'
        default: return 'unknown'
    }
}
