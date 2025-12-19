/**
 * Bulk User Import API
 * 
 * POST /api/admin/users/import - Import users from CSV (Admin only)
 * 
 * Accepts CSV file, parses users, creates them in Zammad
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
    successResponse,
    unauthorizedResponse,
    serverErrorResponse,
    validationErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers, mockPasswords } from '@/lib/mock-auth'
import { getGroupIdByRegion, isValidRegion } from '@/lib/constants/regions'

interface ParsedUser {
    email: string
    full_name: string
    role: 'customer' | 'staff' | 'admin'
    region: string
    phone?: string
    password?: string
}

interface ImportResult {
    success: boolean
    email: string
    full_name?: string
    password?: string
    error?: string
    zammad_id?: number
}

// Parse CSV content into user objects
function parseCSV(content: string): { users: ParsedUser[], errors: string[] } {
    const lines = content.trim().split('\n')
    const errors: string[] = []
    const users: ParsedUser[] = []

    if (lines.length < 2) {
        errors.push('CSV must have a header row and at least one data row')
        return { users, errors }
    }

    // Parse header
    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
    const emailIdx = header.indexOf('email')
    const nameIdx = header.findIndex(h => h.includes('name') || h === 'full_name')
    const roleIdx = header.indexOf('role')
    const regionIdx = header.indexOf('region')
    const phoneIdx = header.indexOf('phone')
    const passwordIdx = header.indexOf('password')

    if (emailIdx === -1) {
        errors.push('Missing required column: email')
        return { users, errors }
    }
    if (nameIdx === -1) {
        errors.push('Missing required column: name or full_name')
        return { users, errors }
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Simple CSV parsing (handles basic quoted fields)
        const values = parseCSVLine(line)

        const email = values[emailIdx]?.trim()
        const full_name = values[nameIdx]?.trim()
        const role = (values[roleIdx]?.trim().toLowerCase() || 'customer') as 'customer' | 'staff' | 'admin'
        const region = values[regionIdx]?.trim() || 'asia-pacific'
        const phone = values[phoneIdx]?.trim()
        const password = values[passwordIdx]?.trim() || generatePassword()

        // Validate
        if (!email || !email.includes('@')) {
            errors.push(`Row ${i + 1}: Invalid email "${email}"`)
            continue
        }
        if (!full_name) {
            errors.push(`Row ${i + 1}: Missing name for ${email}`)
            continue
        }
        if (!['customer', 'staff', 'admin'].includes(role)) {
            errors.push(`Row ${i + 1}: Invalid role "${role}" for ${email}, using "customer"`)
        }

        users.push({
            email,
            full_name,
            role: ['customer', 'staff', 'admin'].includes(role) ? role : 'customer',
            region: isValidRegion(region) ? region : 'asia-pacific',
            phone,
            password,
        })
    }

    return { users, errors }
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim())
            current = ''
        } else {
            current += char
        }
    }
    values.push(current.trim())
    return values
}

// Generate a random password
function generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
    let password = ''
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
}

export async function POST(request: NextRequest) {
    try {
        // Verify admin permission
        await requireRole(['admin'])

        // Parse form data
        const formData = await request.formData()
        const file = formData.get('file') as File
        const previewOnly = formData.get('preview') === 'true'

        if (!file) {
            return validationErrorResponse([{ path: ['file'], message: 'No file provided' }])
        }

        // Validate file type
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            return validationErrorResponse([{ path: ['file'], message: 'Only CSV files are allowed' }])
        }

        // Read file content
        const content = await file.text()
        const { users, errors: parseErrors } = parseCSV(content)

        // Preview mode - just return parsed data
        if (previewOnly) {
            return successResponse({
                preview: true,
                users: users.map(u => ({ ...u, password: '********' })), // Hide passwords
                errors: parseErrors,
                total: users.length,
                valid: users.length,
            })
        }

        // Import mode - create users in Zammad
        const results: ImportResult[] = []
        let successCount = 0
        let failCount = 0

        for (const user of users) {
            try {
                // Check if user already exists
                if (mockUsers[user.email]) {
                    results.push({ success: false, email: user.email, error: 'User already exists' })
                    failCount++
                    continue
                }

                // Prepare Zammad user data
                const [firstname, ...lastnameArr] = user.full_name.split(' ')
                const lastname = lastnameArr.join(' ') || firstname

                // Determine Zammad roles
                let zammadRoles: string[]
                if (user.role === 'admin') {
                    zammadRoles = ['Admin', 'Agent']
                } else if (user.role === 'staff') {
                    zammadRoles = ['Agent']
                } else {
                    zammadRoles = ['Customer']
                }

                // Prepare group_ids for staff
                let groupIds: Record<string, string[]> | undefined
                if (user.role === 'staff') {
                    const groupId = getGroupIdByRegion(user.region as any)
                    groupIds = { [groupId.toString()]: ['full'] }
                }

                // Create user in Zammad
                const zammadUser = await zammadClient.createUser({
                    login: user.email,
                    email: user.email,
                    firstname,
                    lastname,
                    password: user.password!,
                    roles: zammadRoles,
                    phone: user.phone || '',
                    note: `Region: ${user.region}`,
                    group_ids: groupIds,
                    active: true,
                    verified: true,
                })

                // Store in mock data for auth
                mockUsers[user.email] = {
                    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    email: user.email,
                    role: user.role,
                    full_name: user.full_name,
                    phone: user.phone,
                    language: 'zh-CN',
                    region: user.region,
                    zammad_id: zammadUser.id,
                    created_at: new Date().toISOString(),
                }
                mockPasswords[user.email] = user.password!

                results.push({ success: true, email: user.email, full_name: user.full_name, password: user.password, zammad_id: zammadUser.id })
                successCount++

            } catch (error: any) {
                results.push({ success: false, email: user.email, error: error.message })
                failCount++
            }
        }

        return successResponse({
            preview: false,
            results,
            summary: {
                total: users.length,
                success: successCount,
                failed: failCount,
                parseErrors: parseErrors.length,
            },
            parseErrors,
        })

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
            return unauthorizedResponse()
        }
        console.error('[Import Users API] Error:', error)
        return serverErrorResponse('Failed to import users', error.message)
    }
}
