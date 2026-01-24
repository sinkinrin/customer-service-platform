/**
 * User Export API
 * 
 * GET /api/admin/users/export - Export users to CSV (Admin only)
 * 
 * Fetches real user data from Zammad and exports as CSV download
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import { unauthorizedResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { getRegionByGroupId } from '@/lib/constants/regions'
import { ZAMMAD_ROLES } from '@/lib/constants/zammad'
import { logger } from '@/lib/utils/logger'

// Map Zammad role_ids to our role names
function getRoleFromZammad(roleIds: number[]): 'admin' | 'staff' | 'customer' {
    if (roleIds.includes(ZAMMAD_ROLES.ADMIN)) return 'admin'
    if (roleIds.includes(ZAMMAD_ROLES.AGENT)) return 'staff'
    return 'customer'
}

// Get primary region from group_ids
function getRegionFromGroupIds(groupIds?: Record<string, string[]>): string {
    if (!groupIds) return ''

    // Find first group with 'full' permission
    for (const [groupId, permissions] of Object.entries(groupIds)) {
        if (permissions.includes('full')) {
            const region = getRegionByGroupId(parseInt(groupId))
            if (region) return region
        }
    }
    return ''
}

// Escape CSV field
function escapeCSV(value: string | null | undefined): string {
    if (value == null) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

export async function GET(request: NextRequest) {
    try {
        // Verify admin permission
        await requireRole(['admin'])

        const { searchParams } = new URL(request.url)
        const roleFilter = searchParams.get('role') // 'admin', 'staff', 'customer', or null for all

        // Fetch all users from Zammad
        const zammadUsers = await zammadClient.searchUsers('*')

        // Filter and transform users
        let users = zammadUsers.map(user => {
            const role = getRoleFromZammad(user.role_ids || [])
            const region = getRegionFromGroupIds(user.group_ids)

            return {
                id: user.id,
                email: user.email,
                full_name: `${user.firstname || ''} ${user.lastname || ''}`.trim(),
                role,
                region,
                phone: user.phone || '',
                active: user.active,
                verified: user.verified,
                created_at: user.created_at,
                last_login: user.last_login || '',
            }
        })

        // Apply role filter if specified
        if (roleFilter && ['admin', 'staff', 'customer'].includes(roleFilter)) {
            users = users.filter(u => u.role === roleFilter)
        }

        // Generate CSV content
        const headers = ['ID', 'Email', 'Full Name', 'Role', 'Region', 'Phone', 'Status', 'Verified', 'Created At', 'Last Login']
        const csvRows = [
            headers.join(','),
            ...users.map(user => [
                escapeCSV(String(user.id)),
                escapeCSV(user.email),
                escapeCSV(user.full_name),
                escapeCSV(user.role),
                escapeCSV(user.region),
                escapeCSV(user.phone),
                escapeCSV(user.active ? 'Active' : 'Disabled'),
                escapeCSV(user.verified ? 'Yes' : 'No'),
                escapeCSV(user.created_at),
                escapeCSV(user.last_login),
            ].join(','))
        ]

        const csvContent = csvRows.join('\n')
        const filename = `users-export-${new Date().toISOString().split('T')[0]}.csv`

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        logger.error('UserExport', 'Failed to export users', { data: { error: error instanceof Error ? error.message : error } })
        return serverErrorResponse('Failed to export users', error.message)
    }
}
