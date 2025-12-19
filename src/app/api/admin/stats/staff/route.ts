/**
 * Staff 绩效统计 API
 * 返回员工处理工单排名和绩效数据
 * 
 * 使用真实的 Zammad 数据计算员工绩效
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    serverErrorResponse,
    unauthorizedResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'

interface StaffPerformance {
    id: string
    name: string
    email: string
    region: string
    ticketsHandled: number
    ticketsOpen: number
    ticketsClosed: number
    avgResponseTime: string // in hours
    avgResolutionTime: string // in hours
    satisfactionRate: number // 0-100
}

// Map group_id to region name
const GROUP_TO_REGION: Record<number, string> = {
    2: 'asia',
    3: 'europe',
    4: 'americas',
    5: 'middle-east',
    6: 'africa',
    7: 'oceania',
}

export async function GET(request: NextRequest) {
    try {
        await requireRole(['admin'])

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '10')

        // Get all agents from Zammad
        const agents = await zammadClient.getAgents(true)

        // Get all tickets to calculate statistics
        const allTickets = await zammadClient.getAllTickets()

        // Calculate performance for each agent
        const performanceData: StaffPerformance[] = []

        for (const agent of agents) {
            // Skip system accounts
            if (agent.email?.includes('support@') || agent.email?.includes('howensupport@')) {
                continue
            }

            // Get tickets owned by this agent
            const agentTickets = allTickets.filter(t => t.owner_id === agent.id)

            // Count by status
            // state_id: 1=new, 2=open, 3=pending reminder, 4=closed, 5=merged, 6=removed, 7=pending close
            const openTickets = agentTickets.filter(t => [1, 2, 3, 7].includes(t.state_id))
            const closedTickets = agentTickets.filter(t => [4, 5].includes(t.state_id))

            // Calculate average times
            let totalResponseTime = 0
            let totalResolutionTime = 0
            let responseTimeCount = 0
            let resolutionTimeCount = 0

            for (const ticket of agentTickets) {
                const createdAt = new Date(ticket.created_at)
                const updatedAt = new Date(ticket.updated_at)

                // Estimate response time as time from creation to first update (simplified)
                const responseTime = (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60) // hours
                if (responseTime > 0 && responseTime < 168) { // Less than 1 week
                    totalResponseTime += responseTime
                    responseTimeCount++
                }

                // Resolution time for closed tickets
                if ([4, 5].includes(ticket.state_id)) {
                    const closedAt = ticket.close_at ? new Date(ticket.close_at) : updatedAt
                    const resolutionTime = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
                    if (resolutionTime > 0) {
                        totalResolutionTime += resolutionTime
                        resolutionTimeCount++
                    }
                }
            }

            const avgResponseTime = responseTimeCount > 0
                ? (totalResponseTime / responseTimeCount).toFixed(1)
                : '0'
            const avgResolutionTime = resolutionTimeCount > 0
                ? (totalResolutionTime / resolutionTimeCount).toFixed(1)
                : '0'

            // Calculate satisfaction rate based on closed ratio (simplified)
            // In production, this would come from customer feedback data
            const totalHandled = agentTickets.length
            const closedRatio = totalHandled > 0 ? closedTickets.length / totalHandled : 0
            const satisfactionRate = totalHandled > 0
                ? Math.min(100, Math.round(70 + closedRatio * 30)) // Base 70% + bonus for resolution
                : 0

            // Get primary region from agent's group assignments
            const agentGroupIds = agent.group_ids || {}
            let region = 'unknown'
            for (const groupId of Object.keys(agentGroupIds)) {
                const regionName = GROUP_TO_REGION[parseInt(groupId)]
                if (regionName) {
                    region = regionName
                    break
                }
            }

            const name = agent.firstname && agent.lastname
                ? `${agent.firstname} ${agent.lastname}`.trim()
                : agent.login || agent.email || `Agent ${agent.id}`

            performanceData.push({
                id: String(agent.id),
                name,
                email: agent.email || '',
                region,
                ticketsHandled: totalHandled,
                ticketsOpen: openTickets.length,
                ticketsClosed: closedTickets.length,
                avgResponseTime: `${avgResponseTime}h`,
                avgResolutionTime: `${avgResolutionTime}h`,
                satisfactionRate,
            })
        }

        // Sort by tickets handled (descending)
        performanceData.sort((a, b) => b.ticketsHandled - a.ticketsHandled)

        // Apply limit
        const limitedData = performanceData.slice(0, limit)

        // Calculate team averages
        const teamStats = {
            totalStaff: performanceData.length,
            totalTicketsHandled: performanceData.reduce((sum, s) => sum + s.ticketsHandled, 0),
            totalTicketsOpen: performanceData.reduce((sum, s) => sum + s.ticketsOpen, 0),
            totalTicketsClosed: performanceData.reduce((sum, s) => sum + s.ticketsClosed, 0),
            avgSatisfactionRate: performanceData.length > 0
                ? Math.round(performanceData.reduce((sum, s) => sum + s.satisfactionRate, 0) / performanceData.length)
                : 0,
        }

        return successResponse({
            staff: limitedData,
            teamStats,
            source: 'zammad', // Indicate real data source
        })
    } catch (error: any) {
        console.error('[Stats Staff API] Error:', error)
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        return serverErrorResponse('Failed to fetch staff statistics', error.message)
    }
}
