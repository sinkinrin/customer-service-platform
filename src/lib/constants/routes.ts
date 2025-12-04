/**
 * Route Constants
 *
 * Shared route definitions used by middleware and auth configuration.
 * Centralizes route management for consistency across the application.
 */

/**
 * Public routes that don't require authentication.
 * These routes are accessible to all users regardless of login status.
 */
export const PUBLIC_ROUTES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/error",
  "/unauthorized",
  "/api/auth",
  "/api/health",
  "/api/webhooks",
  "/faq",
] as const

/**
 * Static asset routes that should bypass middleware.
 * Used in auth.ts authorized callback (middleware uses matcher config).
 */
export const STATIC_ROUTES = [
  "/_next",
  "/favicon.ico",
] as const

/**
 * Check if a pathname matches any route in the given list.
 * Matches both exact paths and paths that start with route + "/".
 */
export function isRouteMatch(pathname: string, routes: readonly string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
}

/**
 * Role-based route configuration.
 */
export const ROLE_ROUTES = {
  admin: {
    prefix: "/admin",
    allowedRoles: ["admin"] as const,
  },
  staff: {
    prefix: "/staff",
    allowedRoles: ["staff", "admin"] as const,
  },
  customer: {
    prefix: "/customer",
    allowedRoles: ["customer", "staff", "admin"] as const,
  },
} as const

/**
 * Get the default dashboard route for a given role.
 */
export function getDefaultDashboard(role: "customer" | "staff" | "admin"): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard"
    case "staff":
      return "/staff/dashboard"
    case "customer":
    default:
      return "/customer/dashboard"
  }
}
