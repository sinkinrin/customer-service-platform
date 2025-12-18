/**
 * Staff 绩效统计 API
 * 返回员工处理工单排名和绩效数据
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    serverErrorResponse,
    unauthorizedResponse,
} from '@/lib/utils/api-response'
import { mockUsers } from '@/lib/mock-auth'

interface StaffPerformance {
    id: string
    name: string
    email: string
    region: string
    ticketsHandled: number
    avgResponseTime: string // in hours
    avgResolutionTime: string // in hours
    satisfactionRate: number // 0-100
}

// Generate mock performance data for demo
function generateMockPerformanceData(): StaffPerformance[] {
    const staffUsers = Object.values(mockUsers).filter(u => u.role === 'staff')

    return staffUsers.map(staff => ({
        id: staff.id,
        name: staff.full_name,
        email: staff.email,
        region: staff.region || 'unknown',
        ticketsHandled: Math.floor(Math.random() * 50) + 10,
        avgResponseTime: `${(Math.random() * 4 + 0.5).toFixed(1)}h`,
        avgResolutionTime: `${(Math.random() * 24 + 2).toFixed(1)}h`,
        satisfactionRate: Math.floor(Math.random() * 20) + 80,
    })).sort((a, b) => b.ticketsHandled - a.ticketsHandled)
}

export async function GET(request: NextRequest) {
    try {
        await requireRole(['admin'])

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '10')

        // Generate mock data for demo
        const performanceData = generateMockPerformanceData().slice(0, limit)

        // Calculate team averages
        const teamStats = {
            totalStaff: performanceData.length,
            totalTicketsHandled: performanceData.reduce((sum, s) => sum + s.ticketsHandled, 0),
            avgSatisfactionRate: performanceData.length > 0
                ? Math.round(performanceData.reduce((sum, s) => sum + s.satisfactionRate, 0) / performanceData.length)
                : 0,
        }

        return successResponse({
            staff: performanceData,
            teamStats,
        })
    } catch (error: any) {
        console.error('[Stats Staff API] Error:', error)
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        return serverErrorResponse('Failed to fetch staff statistics', error.message)
    }
}
