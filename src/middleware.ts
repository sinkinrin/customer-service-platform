/**
 * Next.js Middleware with NextAuth.js v5
 *
 * Handles:
 * - Session validation via NextAuth
 * - Role-based route protection
 * - Development endpoint protection
 * - Redirect logic for unauthenticated users
 */

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { PUBLIC_ROUTES, isRouteMatch } from "@/lib/constants/routes"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Development endpoints - block in production
  if (pathname.startsWith("/api/dev/")) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Not Found", message: "This endpoint is not available" },
        { status: 404 }
      )
    }
    // In development, allow dev endpoints
    return NextResponse.next()
  }

  // Public routes - always allow (uses shared route constants)
  if (isRouteMatch(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next()
  }

  // Check authentication for protected routes
  const isLoggedIn = !!session?.user

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      )
    }

    // Page routes redirect to login
    const loginUrl = new URL("/auth/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based access control for authenticated users
  const userRole = session.user.role

  // Admin routes - only admin
  if (pathname.startsWith("/admin")) {
    if (userRole !== "admin") {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Forbidden", message: "Admin access required" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
  }

  // Staff routes - staff or admin
  if (pathname.startsWith("/staff")) {
    if (userRole !== "staff" && userRole !== "admin") {
      if (pathname.startsWith("/api/staff")) {
        return NextResponse.json(
          { error: "Forbidden", message: "Staff access required" },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
  }

  // Add custom headers for debugging
  const response = NextResponse.next()
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
