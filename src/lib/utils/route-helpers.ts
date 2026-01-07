/**
 * Route Helper Functions
 * 
 * Utility functions for role-based routing and navigation
 */

export type UserRole = 'customer' | 'staff' | 'admin'

/**
 * Get the default route for a user role
 * 
 * @param role - User role
 * @returns Default route path for the role
 */
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'customer':
      return '/customer/dashboard'
    case 'staff':
      return '/staff/dashboard'
    case 'admin':
      return '/admin/dashboard'
    default:
      return '/'
  }
}

/**
 * Get display name for a user role
 * 
 * @param role - User role
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: UserRole): string {
  return role
}

/**
 * Check if a user role is allowed to access a route
 * 
 * @param userRole - User's role
 * @param allowedRoles - Array of allowed roles
 * @returns True if user role is in allowed roles
 */
export function isRoleAllowed(
  userRole: UserRole | null,
  allowedRoles: UserRole[]
): boolean {
  if (!userRole) return false
  return allowedRoles.includes(userRole)
}

/**
 * Get navigation items based on user role
 * 
 * @param role - User role
 * @returns Array of navigation items
 */
export function getNavigationItemsForRole(role: UserRole): Array<{
  labelKey: string
  href: string
}> {
  switch (role) {
    case 'customer':
      return [
        { labelKey: 'dashboard', href: '/customer/dashboard' },
        { labelKey: 'conversations', href: '/customer/conversations' },
        { labelKey: 'faq', href: '/customer/faq' },
      ]
    case 'staff':
      return [
        { labelKey: 'dashboard', href: '/staff/dashboard' },
        { labelKey: 'tickets', href: '/staff/tickets' },
        { labelKey: 'knowledgeBase', href: '/staff/knowledge-base' },
      ]
    case 'admin':
      return [
        { labelKey: 'dashboard', href: '/admin/dashboard' },
        { labelKey: 'users', href: '/admin/users' },
        { labelKey: 'faq', href: '/admin/faq' },
        { labelKey: 'settings', href: '/admin/settings' },
      ]
    default:
      return []
  }
}

