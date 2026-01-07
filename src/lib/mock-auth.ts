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
  group_ids?: number[]  // Zammad group IDs for permission filtering
  created_at: string
}

export interface MockSession {
  /**
   * Access token for API calls.
   * Optional when using NextAuth.js (JWT-based sessions don't expose tokens).
   */
  access_token?: string
  /**
   * Refresh token for session renewal.
   * Optional when using NextAuth.js (JWT-based sessions don't expose tokens).
   */
  refresh_token?: string
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
    created_at: '2025-01-01T00:00:00.000Z',
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
    group_ids: [2],  // Asia-Pacific group
    created_at: '2025-01-01T00:00:00.000Z',
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
    group_ids: [1, 2, 3, 4, 5, 6, 7, 8],  // Admin has all groups
    created_at: '2025-01-01T00:00:00.000Z',
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
    created_at: '2025-01-01T00:00:00.000Z',
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
    created_at: '2025-01-01T00:00:00.000Z',
  },

  // ============ Real Staff Users from Zammad ============
  'cody.li@howentech.com': {
    id: 'staff-cody-li',
    email: 'cody.li@howentech.com',
    role: 'staff',
    full_name: 'Cody Lee',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'asia-pacific',
    zammad_id: 5,  // Matches Zammad user ID
    created_at: '2025-01-01T00:00:00.000Z',
  },

  // ============ Asia-Pacific Region Test Users ============
  'staff-ap-1@test.com': {
    id: 'staff-ap-1-id',
    email: 'staff-ap-1@test.com',
    role: 'staff',
    full_name: '亚太员工一',
    avatar_url: undefined,
    phone: undefined,
    language: 'zh-CN',
    region: 'asia-pacific',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff-ap-2@test.com': {
    id: 'staff-ap-2-id',
    email: 'staff-ap-2@test.com',
    role: 'staff',
    full_name: '亚太员工二',
    avatar_url: undefined,
    phone: undefined,
    language: 'zh-CN',
    region: 'asia-pacific',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-ap-1@test.com': {
    id: 'customer-ap-1-id',
    email: 'customer-ap-1@test.com',
    role: 'customer',
    full_name: '亚太客户一',
    avatar_url: undefined,
    phone: undefined,
    language: 'zh-CN',
    region: 'asia-pacific',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-ap-2@test.com': {
    id: 'customer-ap-2-id',
    email: 'customer-ap-2@test.com',
    role: 'customer',
    full_name: '亚太客户二',
    avatar_url: undefined,
    phone: undefined,
    language: 'zh-CN',
    region: 'asia-pacific',
    created_at: '2025-01-01T00:00:00.000Z',
  },

  // ============ Middle East Region Test Users ============
  'staff-me-1@test.com': {
    id: 'staff-me-1-id',
    email: 'staff-me-1@test.com',
    role: 'staff',
    full_name: 'Middle East Staff 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'middle-east',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff-me-2@test.com': {
    id: 'staff-me-2-id',
    email: 'staff-me-2@test.com',
    role: 'staff',
    full_name: 'Middle East Staff 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'middle-east',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-me-1@test.com': {
    id: 'customer-me-1-id',
    email: 'customer-me-1@test.com',
    role: 'customer',
    full_name: 'Middle East Customer 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'middle-east',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-me-2@test.com': {
    id: 'customer-me-2-id',
    email: 'customer-me-2@test.com',
    role: 'customer',
    full_name: 'Middle East Customer 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'middle-east',
    created_at: '2025-01-01T00:00:00.000Z',
  },

  // ============ Africa Region Test Users ============
  'staff-af-1@test.com': {
    id: 'staff-af-1-id',
    email: 'staff-af-1@test.com',
    role: 'staff',
    full_name: 'Africa Staff 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'africa',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff-af-2@test.com': {
    id: 'staff-af-2-id',
    email: 'staff-af-2@test.com',
    role: 'staff',
    full_name: 'Africa Staff 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'africa',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-af-1@test.com': {
    id: 'customer-af-1-id',
    email: 'customer-af-1@test.com',
    role: 'customer',
    full_name: 'Africa Customer 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'africa',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-af-2@test.com': {
    id: 'customer-af-2-id',
    email: 'customer-af-2@test.com',
    role: 'customer',
    full_name: 'Africa Customer 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'africa',
    created_at: '2025-01-01T00:00:00.000Z',
  },

  // ============ Europe Zone 1 Region Test Users ============
  'staff-eu-1@test.com': {
    id: 'staff-eu-1-id',
    email: 'staff-eu-1@test.com',
    role: 'staff',
    full_name: 'Europe Staff 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'europe-zone-1',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff-eu-2@test.com': {
    id: 'staff-eu-2-id',
    email: 'staff-eu-2@test.com',
    role: 'staff',
    full_name: 'Europe Staff 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'europe-zone-1',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-eu-1@test.com': {
    id: 'customer-eu-1-id',
    email: 'customer-eu-1@test.com',
    role: 'customer',
    full_name: 'Europe Customer 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'europe-zone-1',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-eu-2@test.com': {
    id: 'customer-eu-2-id',
    email: 'customer-eu-2@test.com',
    role: 'customer',
    full_name: 'Europe Customer 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'en',
    region: 'europe-zone-1',
    created_at: '2025-01-01T00:00:00.000Z',
  },

  // ============ CIS Region Test Users ============
  'staff-cis-1@test.com': {
    id: 'staff-cis-1-id',
    email: 'staff-cis-1@test.com',
    role: 'staff',
    full_name: 'CIS Staff 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'ru',
    region: 'cis',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff-cis-2@test.com': {
    id: 'staff-cis-2-id',
    email: 'staff-cis-2@test.com',
    role: 'staff',
    full_name: 'CIS Staff 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'ru',
    region: 'cis',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-cis-1@test.com': {
    id: 'customer-cis-1-id',
    email: 'customer-cis-1@test.com',
    role: 'customer',
    full_name: 'CIS Customer 1',
    avatar_url: undefined,
    phone: undefined,
    language: 'ru',
    region: 'cis',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer-cis-2@test.com': {
    id: 'customer-cis-2-id',
    email: 'customer-cis-2@test.com',
    role: 'customer',
    full_name: 'CIS Customer 2',
    avatar_url: undefined,
    phone: undefined,
    language: 'ru',
    region: 'cis',
    created_at: '2025-01-01T00:00:00.000Z',
  },

  // ============ Zammad Real Users (from 1.csv) ============
  'customer.apac@test.com': {
    id: 'zammad-15',
    email: 'customer.apac@test.com',
    role: 'customer',
    full_name: 'APAC Customer',
    avatar_url: undefined,
    phone: '+861234567001',
    language: 'en',
    region: 'asia-pacific',
    zammad_id: 15,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.apac@test.com': {
    id: 'zammad-16',
    email: 'staff.apac@test.com',
    role: 'staff',
    full_name: 'APAC Staff',
    avatar_url: undefined,
    phone: '+861234567002',
    language: 'en',
    region: 'asia-pacific',
    zammad_id: 16,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer.me@test.com': {
    id: 'zammad-17',
    email: 'customer.me@test.com',
    role: 'customer',
    full_name: 'Middle East Customer',
    avatar_url: undefined,
    phone: '+9711234567001',
    language: 'en',
    region: 'middle-east',
    zammad_id: 17,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.me@test.com': {
    id: 'zammad-18',
    email: 'staff.me@test.com',
    role: 'staff',
    full_name: 'Middle East Staff',
    avatar_url: undefined,
    phone: '+9711234567002',
    language: 'en',
    region: 'middle-east',
    zammad_id: 18,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer.africa@test.com': {
    id: 'zammad-19',
    email: 'customer.africa@test.com',
    role: 'customer',
    full_name: 'Africa Customer',
    avatar_url: undefined,
    phone: '+271234567001',
    language: 'en',
    region: 'africa',
    zammad_id: 19,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.africa@test.com': {
    id: 'zammad-20',
    email: 'staff.africa@test.com',
    role: 'staff',
    full_name: 'Africa Staff',
    avatar_url: undefined,
    phone: '+271234567002',
    language: 'en',
    region: 'africa',
    zammad_id: 20,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer.na@test.com': {
    id: 'zammad-21',
    email: 'customer.na@test.com',
    role: 'customer',
    full_name: 'North America Customer',
    avatar_url: undefined,
    phone: '+11234567001',
    language: 'en',
    region: 'north-america',
    zammad_id: 21,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.na@test.com': {
    id: 'zammad-22',
    email: 'staff.na@test.com',
    role: 'staff',
    full_name: 'North America Staff',
    avatar_url: undefined,
    phone: '+11234567002',
    language: 'en',
    region: 'north-america',
    zammad_id: 22,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer.latam@test.com': {
    id: 'zammad-23',
    email: 'customer.latam@test.com',
    role: 'customer',
    full_name: 'Latin America Customer',
    avatar_url: undefined,
    phone: '+551234567001',
    language: 'en',
    region: 'latin-america',
    zammad_id: 23,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.latam@test.com': {
    id: 'zammad-24',
    email: 'staff.latam@test.com',
    role: 'staff',
    full_name: 'Latin America Staff',
    avatar_url: undefined,
    phone: '+551234567002',
    language: 'en',
    region: 'latin-america',
    zammad_id: 24,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer.eu1@test.com': {
    id: 'zammad-25',
    email: 'customer.eu1@test.com',
    role: 'customer',
    full_name: 'Europe Zone 1 Customer',
    avatar_url: undefined,
    phone: '+441234567001',
    language: 'en',
    region: 'europe-zone-1',
    zammad_id: 25,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.eu1@test.com': {
    id: 'zammad-26',
    email: 'staff.eu1@test.com',
    role: 'staff',
    full_name: 'Europe Zone 1 Staff',
    avatar_url: undefined,
    phone: '+441234567002',
    language: 'en',
    region: 'europe-zone-1',
    zammad_id: 26,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer.eu2@test.com': {
    id: 'zammad-27',
    email: 'customer.eu2@test.com',
    role: 'customer',
    full_name: 'Europe Zone 2 Customer',
    avatar_url: undefined,
    phone: '+491234567001',
    language: 'en',
    region: 'europe-zone-2',
    zammad_id: 27,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.eu2@test.com': {
    id: 'zammad-28',
    email: 'staff.eu2@test.com',
    role: 'staff',
    full_name: 'Europe Zone 2 Staff',
    avatar_url: undefined,
    phone: '+491234567002',
    language: 'en',
    region: 'europe-zone-2',
    zammad_id: 28,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'customer.cis@test.com': {
    id: 'zammad-29',
    email: 'customer.cis@test.com',
    role: 'customer',
    full_name: 'CIS Customer',
    avatar_url: undefined,
    phone: '+71234567001',
    language: 'ru',
    region: 'cis',
    zammad_id: 29,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  'staff.cis@test.com': {
    id: 'zammad-30',
    email: 'staff.cis@test.com',
    role: 'staff',
    full_name: 'CIS Staff',
    avatar_url: undefined,
    phone: '+71234567002',
    language: 'ru',
    region: 'cis',
    zammad_id: 30,
    created_at: '2025-01-01T00:00:00.000Z',
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
  // Asia-Pacific
  'staff-ap-1@test.com': 'password123',
  'staff-ap-2@test.com': 'password123',
  'customer-ap-1@test.com': 'password123',
  'customer-ap-2@test.com': 'password123',
  // Middle East
  'staff-me-1@test.com': 'password123',
  'staff-me-2@test.com': 'password123',
  'customer-me-1@test.com': 'password123',
  'customer-me-2@test.com': 'password123',
  // Africa
  'staff-af-1@test.com': 'password123',
  'staff-af-2@test.com': 'password123',
  'customer-af-1@test.com': 'password123',
  'customer-af-2@test.com': 'password123',
  // Europe
  'staff-eu-1@test.com': 'password123',
  'staff-eu-2@test.com': 'password123',
  'customer-eu-1@test.com': 'password123',
  'customer-eu-2@test.com': 'password123',
  // CIS
  'staff-cis-1@test.com': 'password123',
  'staff-cis-2@test.com': 'password123',
  'customer-cis-1@test.com': 'password123',
  'customer-cis-2@test.com': 'password123',
  // Zammad Real Users (from 1.csv)
  'customer.apac@test.com': '12345678',
  'staff.apac@test.com': '12345678',
  'customer.me@test.com': '12345678',
  'staff.me@test.com': '12345678',
  'customer.africa@test.com': '12345678',
  'staff.africa@test.com': '12345678',
  'customer.na@test.com': '12345678',
  'staff.na@test.com': '12345678',
  'customer.latam@test.com': '12345678',
  'staff.latam@test.com': '12345678',
  'customer.eu1@test.com': '12345678',
  'staff.eu1@test.com': '12345678',
  'customer.eu2@test.com': '12345678',
  'staff.eu2@test.com': '12345678',
  'customer.cis@test.com': '12345678',
  'staff.cis@test.com': '12345678',
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
    created_at: '2025-01-01T00:00:00.000Z',
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

