/**
 * Next.js Middleware
 *
 * TODO: Replace with real authentication middleware (e.g., NextAuth.js middleware)
 * This is a temporary bypass to allow development with mock authentication
 */

import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(_request: NextRequest) {
  // TODO: Implement real authentication check
  // For now, allow all requests to pass through

  // Optional: Add custom headers for debugging
  const response = NextResponse.next()
  response.headers.set('x-middleware-bypass', 'true')

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

