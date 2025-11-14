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
  switch (role) {
    case 'customer':
      return 'Customer'
    case 'staff':
      return 'Staff'
    case 'admin':
      return 'Administrator'
    default:
      return 'User'
  }
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
  label: string
  href: string
}> {
  switch (role) {
    case 'customer':
      return [
        { label: '仪表板', href: '/customer/dashboard' },
        { label: '在线咨询', href: '/customer/conversations' },
        { label: '知识库', href: '/customer/faq' },
      ]
    case 'staff':
      return [
        { label: 'Dashboard', href: '/staff/dashboard' },
        { label: 'Tickets', href: '/staff/tickets' },
        { label: 'Knowledge Base', href: '/staff/knowledge-base' },
      ]
    case 'admin':
      return [
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Users', href: '/admin/users' },
        { label: 'FAQ', href: '/admin/faq' },
        { label: 'Settings', href: '/admin/settings' },
      ]
    default:
      return []
  }
}

