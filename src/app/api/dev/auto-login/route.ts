/**
 * Development Auto-Login API
 * 
 * ONLY WORKS IN DEVELOPMENT MODE
 * Allows quick login for testing purposes
 * 
 * POST /api/dev/auto-login
 * Body: { role: 'customer' | 'staff' | 'admin' }
 */

import { NextRequest } from 'next/server'
import { successResponse, serverErrorResponse, errorResponse } from '@/lib/utils/api-response'
import { mockSignIn } from '@/lib/mock-auth'

// TODO: Replace with real authentication when implemented
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return errorResponse('NOT_AVAILABLE', 'This endpoint is only available in development mode', undefined, 403)
  }

  try {
    const body = await request.json()
    const { role = 'customer' } = body

    // Map role to test email
    const emailMap: Record<string, string> = {
      customer: 'customer@test.com',
      staff: 'staff@test.com',
      admin: 'admin@test.com',
    }

    const email = emailMap[role]
    if (!email) {
      return errorResponse('INVALID_ROLE', 'Role must be customer, staff, or admin', undefined, 400)
    }

    // Use mock authentication (password is 'password123' for all test accounts)
    const result = await mockSignIn(email, 'password123')

    if (result.error || !result.user || !result.session) {
      return errorResponse('LOGIN_FAILED', result.error || 'Invalid credentials', undefined, 401)
    }

    return successResponse({
      user: result.user,
      session: result.session,
      role,
    })
  } catch (error: any) {
    return serverErrorResponse('Auto-login failed', error.message)
  }
}

