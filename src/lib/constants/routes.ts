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
  "/",
  "/login",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/error",
  "/unauthorized",
  "/api/auth",
  "/api/health",
  "/api/webhooks",
  "/api/faq",
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

export type AppRole = "customer" | "staff" | "admin"

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
 * Get allowed roles for a protected portal pathname.
 * Returns null when the pathname does not match a role-protected portal route.
 */
export function getAllowedRolesForPath(pathname: string): readonly AppRole[] | null {
  if (pathname.startsWith(ROLE_ROUTES.admin.prefix)) {
    return ROLE_ROUTES.admin.allowedRoles
  }
  if (pathname.startsWith(ROLE_ROUTES.staff.prefix)) {
    return ROLE_ROUTES.staff.allowedRoles
  }
  if (pathname.startsWith(ROLE_ROUTES.customer.prefix)) {
    return ROLE_ROUTES.customer.allowedRoles
  }
  return null
}

/**
 * Check whether a role can access a protected portal pathname.
 */
export function isRoleAllowedForPath(pathname: string, role?: AppRole | null): boolean {
  if (!role) return false
  const allowedRoles = getAllowedRolesForPath(pathname)
  if (!allowedRoles) return true
  return allowedRoles.includes(role)
}

/**
 * Get the default dashboard route for a given role.
 */
export function getDefaultDashboard(role: AppRole): string {
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
