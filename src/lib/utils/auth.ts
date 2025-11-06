/**
 * Authentication Utilities
 *
 * TODO: Replace with real authentication utilities
 * This is a temporary mock implementation for development
 */

import { mockGetUser, type MockUser } from '@/lib/mock-auth'

export async function getCurrentUser(): Promise<MockUser | null> {
  // TODO: Replace with real authentication check
  return await mockGetUser()
}

export async function requireAuth(): Promise<MockUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

export async function getUserRole(_userId: string): Promise<'customer' | 'staff' | 'admin'> {
  // TODO: Replace with real database query
  const user = await mockGetUser()

  if (!user) {
    return 'customer' // Default role
  }

  return user.role
}

export async function requireRole(allowedRoles: ('customer' | 'staff' | 'admin')[]): Promise<MockUser> {
  const user = await requireAuth()
  const role = await getUserRole(user.id)

  if (!allowedRoles.includes(role)) {
    throw new Error('Forbidden')
  }

  return user
}

export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'admin'
}

export async function isStaff(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'staff' || role === 'admin'
}

