/**
 * Mock Authentication System with Cookie-Based Sessions
 *
 * Uses HTTP cookies for session storage (works on both client and server)
 * TODO: Replace with real authentication system (e.g., NextAuth.js, Auth0, Clerk)
 */

import { clientCookies, universalCookies } from '@/lib/utils/cookies'

export interface MockUser {
  id: string
  email: string
  role: 'customer' | 'staff' | 'admin'
  full_name: string
  avatar_url?: string
  phone?: string
  language?: string
  region?: string  // User's assigned region (for staff/customer)
  zammad_id?: number  // Zammad user ID for API integration
  created_at: string
}

export interface MockSession {
  access_token: string
  refresh_token: string
  expires_at: number
  user: MockUser
}

// Mock users for testing
export const mockUsers: Record<string, MockUser> = {
  'customer@test.com': {
    id: 'mock-customer-id',
    email: 'customer@test.com',
    role: 'customer',
    full_name: 'Test Customer',
    avatar_url: undefined,
    phone: '+1234567890',
    language: 'en',
    region: 'asia-pacific',
    created_at: new Date().toISOString(),
  },
  'staff@test.com': {
    id: 'mock-staff-id',
    email: 'staff@test.com',
    role: 'staff',
    full_name: 'Test Staff',
    avatar_url: undefined,
    phone: '+1234567891',
    language: 'en',
    region: 'asia-pacific',
    created_at: new Date().toISOString(),
  },
  'admin@test.com': {
    id: 'mock-admin-id',
    email: 'admin@test.com',
    role: 'admin',
    full_name: 'Test Admin',
    avatar_url: undefined,
    phone: '+1234567892',
    language: 'en',
    region: undefined,  // Admin can access all regions
    created_at: new Date().toISOString(),
  },
  // Real user account for testing
  'jasper.deng@howentech.com': {
    id: 'real-customer-id',
    email: 'jasper.deng@howentech.com',
    role: 'customer',
    full_name: 'Jasper Deng',
    avatar_url: undefined,
    phone: undefined,
    language: 'zh-CN',
    region: 'asia-pacific',
    created_at: new Date().toISOString(),
  },
  // Playwright test user
  'playwright-test-user@example.com': {
    id: 'playwright-test-user-id',
    email: 'playwright-test-user@example.com',
    role: 'staff',
    full_name: 'Playwright Test User',
    avatar_url: undefined,
    phone: undefined,
    language: 'zh-CN',
    region: 'asia-pacific',
    created_at: new Date().toISOString(),
  },
}

// Default mock user (customer)
export const defaultMockUser: MockUser = mockUsers['customer@test.com']

// Mock passwords for testing
export const mockPasswords: Record<string, string> = {
  'customer@test.com': 'password123',
  'staff@test.com': 'password123',
  'admin@test.com': 'password123',
  'jasper.deng@howentech.com': '12345678',
  'playwright-test-user@example.com': 'testpass123',
}

/**
 * Mock sign in - validates password
 */
export async function mockSignIn(email: string, password: string): Promise<{ user: MockUser; session: MockSession; error: null } | { user: null; session: null; error: string }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Check if user exists
  const user = mockUsers[email]
  if (!user) {
    return { user: null, session: null, error: 'Invalid email or password' }
  }

  // Validate password
  const expectedPassword = mockPasswords[email]
  if (password !== expectedPassword) {
    return { user: null, session: null, error: 'Invalid email or password' }
  }

  const session: MockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000, // 1 hour
    user,
  }

  // Store session in cookie (client-side only)
  if (typeof window !== 'undefined') {
    clientCookies.setSession(session)
  }

  return { user, session, error: null }
}

/**
 * Mock sign up - always succeeds
 */
export async function mockSignUp(email: string, password: string, metadata?: { full_name?: string }): Promise<{ user: MockUser; session: MockSession; error: null }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const user: MockUser = {
    id: `mock-user-${Date.now()}`,
    email,
    role: 'customer',
    full_name: metadata?.full_name || 'New User',
    created_at: new Date().toISOString(),
  }
  
  const session: MockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000,
    user,
  }
  
  return { user, session, error: null }
}

/**
 * Mock sign out - removes session cookie
 */
export async function mockSignOut(): Promise<{ error: null }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200))

  // Remove session cookie (client-side only)
  if (typeof window !== 'undefined') {
    clientCookies.removeSession()
  }

  return { error: null }
}

/**
 * Mock get user - returns user from cookie session (works on both client and server)
 */
export async function mockGetUser(): Promise<MockUser | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100))

  // Get session from cookie (works on both client and server)
  try {
    const session = await universalCookies.getSession()
    if (session?.user) {
      return session.user
    }
  } catch (error) {
    console.error('Error reading user from cookie:', error)
  }

  return null
}

/**
 * Mock get session - returns session from cookie (works on both client and server)
 */
export async function mockGetSession(): Promise<MockSession | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100))

  // Get session from cookie (works on both client and server)
  try {
    const session = await universalCookies.getSession()
    return session
  } catch (error) {
    console.error('Error reading session from cookie:', error)
  }

  return null
}

/**
 * Mock update user - always succeeds
 */
export async function mockUpdateUser(updates: Partial<MockUser>): Promise<{ user: MockUser; error: null }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  const user = { ...defaultMockUser, ...updates }
  return { user, error: null }
}

/**
 * Mock reset password - always succeeds
 */
export async function mockResetPassword(_email: string): Promise<{ error: null }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  return { error: null }
}

/**
 * Mock get user by ID - returns user from mockUsers
 */
export async function mockGetUserById(userId: string): Promise<MockUser | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100))

  // Search for user by ID
  const user = Object.values(mockUsers).find(u => u.id === userId)
  return user || null
}

/**
 * Mock update user role - updates user role in mockUsers
 */
export async function mockUpdateUserRole(userId: string, role: 'customer' | 'staff' | 'admin'): Promise<MockUser | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300))

  // Find user by ID
  const userEntry = Object.entries(mockUsers).find(([_, u]) => u.id === userId)
  if (!userEntry) {
    return null
  }

  // Update user role (in-memory only)
  const [email, user] = userEntry
  user.role = role
  mockUsers[email] = user

  return user
}

