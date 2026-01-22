/**
 * Next.js Middleware with NextAuth.js v5
 *
 * Handles:
 * - Request ID generation for tracing
 * - Session validation via NextAuth
 * - Role-based route protection
 * - Development endpoint protection
 * - Redirect logic for unauthenticated users
 */

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { PUBLIC_ROUTES, isRouteMatch } from "@/lib/constants/routes"
import { generateRequestId } from "@/lib/utils/request-id"

/**
 * Helper to create JSON response with request ID header
 */
function jsonResponse(
  data: object,
  status: number,
  requestId: string
): NextResponse {
  const response = NextResponse.json(data, { status })
  response.headers.set("x-request-id", requestId)
  return response
}

/**
 * Helper to create redirect response with request ID header
 */
function redirectResponse(url: URL, requestId: string): NextResponse {
  const response = NextResponse.redirect(url)
  response.headers.set("x-request-id", requestId)
  return response
}

/**
 * Helper to create NextResponse.next() that forwards the request ID downstream
 */
function nextResponseWithRequestId(req: Request, requestId: string): NextResponse {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-request-id", requestId)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set("x-request-id", requestId)
  return response
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Generate request ID for tracing
  // Format: G{groupId}-{role}-{zammadId}-{timestamp}-{random}
  const requestId = generateRequestId({
    region: session?.user?.region,
    role: session?.user?.role,
    zammadId: session?.user?.zammad_id,
  })

  // Development endpoints - block in production
  if (pathname.startsWith("/api/dev/")) {
    if (process.env.NODE_ENV === "production") {
      return jsonResponse(
        { error: "Not Found", message: "This endpoint is not available" },
        404,
        requestId
      )
    }
    // In development, allow dev endpoints
    return nextResponseWithRequestId(req, requestId)
  }

  // Public routes - always allow (uses shared route constants)
  if (isRouteMatch(pathname, PUBLIC_ROUTES)) {
    return nextResponseWithRequestId(req, requestId)
  }

  // Check authentication for protected routes
  const isLoggedIn = !!session?.user

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return jsonResponse(
        { error: "Unauthorized", message: "Authentication required", requestId },
        401,
        requestId
      )
    }

    // Page routes redirect to login
    const loginUrl = new URL("/auth/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return redirectResponse(loginUrl, requestId)
  }

  // Role-based access control for authenticated users
  const userRole = session.user.role

  // Admin routes - only admin
  if (pathname.startsWith("/admin")) {
    if (userRole !== "admin") {
      if (pathname.startsWith("/api/admin")) {
        return jsonResponse(
          { error: "Forbidden", message: "Admin access required", requestId },
          403,
          requestId
        )
      }
      return redirectResponse(new URL("/unauthorized", req.url), requestId)
    }
  }

  // Staff routes - staff or admin
  if (pathname.startsWith("/staff")) {
    if (userRole !== "staff" && userRole !== "admin") {
      if (pathname.startsWith("/api/staff")) {
        return jsonResponse(
          { error: "Forbidden", message: "Staff access required", requestId },
          403,
          requestId
        )
      }
      return redirectResponse(new URL("/unauthorized", req.url), requestId)
    }
  }

  // Add custom headers for tracing and debugging
  const response = nextResponseWithRequestId(req, requestId)
  response.headers.set("x-user-role", userRole || "anonymous")

  return response
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (dev HMR)
     * - _next/data (app router data)
     * - api/auth (NextAuth internal endpoints)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|_next/data|api/auth|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
