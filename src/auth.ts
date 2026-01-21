/**
 * NextAuth.js v5 Configuration
 *
 * This configuration supports:
 * - Zammad authentication: Real user authentication via Zammad API
 * - Mock authentication: Fallback for development/testing
 *
 * Features:
 * - Credentials provider for email/password login
 * - JWT-based sessions (no database required for sessions)
 * - Role-based access control (customer, staff, admin)
 * - Configurable via environment variables
 */

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"
import { ensureEnvValidation, isMockAuthEnabled, env } from "@/lib/env"
import { PUBLIC_ROUTES, STATIC_ROUTES, isRouteMatch } from "@/lib/constants/routes"
import { zammadClient } from "@/lib/zammad/client"
import { getRegionByGroupId, getGroupIdByRegion, isValidRegion, type RegionValue } from "@/lib/constants/regions"
import { ZAMMAD_ROLES } from "@/lib/constants/zammad"

// Import mock auth for development/fallback mode
import { mockUsers, mockPasswords, type MockUser } from "@/lib/mock-auth"

ensureEnvValidation()

// Extend the built-in types
declare module "next-auth" {
  interface User {
    role?: "customer" | "staff" | "admin"
    full_name?: string
    avatar_url?: string
    phone?: string
    language?: string
    region?: string
    zammad_id?: number
    group_ids?: number[]
  }

  interface Session {
    user: {
      id: string
      email: string
      role: "customer" | "staff" | "admin"
      full_name: string
      avatar_url?: string
      phone?: string
      language?: string
      region?: string
      zammad_id?: number
      group_ids?: number[]
    }
  }
}

const DEFAULT_PRODUCTION_ROLE: MockUser["role"] = "staff"

/**
 * Map Zammad role_ids to our role names
 */
function getRoleFromZammad(roleIds: number[]): 'admin' | 'staff' | 'customer' {
  if (roleIds.includes(ZAMMAD_ROLES.ADMIN)) return 'admin'
  if (roleIds.includes(ZAMMAD_ROLES.AGENT)) return 'staff'
  return 'customer'
}

/**
 * Get region from Zammad group_ids (for Staff/Admin)
 */
function getRegionFromGroupIds(groupIds?: Record<string, string[]>): string | undefined {
  if (!groupIds) return undefined
  for (const [groupId, permissions] of Object.entries(groupIds)) {
    if (permissions.includes('full')) {
      const region = getRegionByGroupId(parseInt(groupId))
      if (region) return region
    }
  }
  return undefined
}

/**
 * Get region from Zammad note field (for Customer)
 * Customer region is stored in note field as "Region: xxx"
 */
function getRegionFromNote(note?: string): string | undefined {
  if (!note) return undefined
  const match = note.match(/Region:\s*(\S+)/)
  if (match && isValidRegion(match[1])) {
    return match[1]
  }
  return undefined
}

/**
 * Extract numeric group IDs from Zammad group_ids object
 */
function extractGroupIds(groupIds?: Record<string, string[]>): number[] {
  if (!groupIds) return []
  return Object.keys(groupIds).map(id => parseInt(id)).filter(id => !isNaN(id))
}

/**
 * Read a single production credential from environment variables
 * Used when mock auth is disabled to allow a controlled login path
 */
function getProductionUserFromEnv(): { user: MockUser; password: string } | null {
  const email = env.AUTH_DEFAULT_USER_EMAIL
  const password = env.AUTH_DEFAULT_USER_PASSWORD

  if (!email || !password) {
    return null
  }

  const role =
    env.AUTH_DEFAULT_USER_ROLE === "customer" ||
    env.AUTH_DEFAULT_USER_ROLE === "staff" ||
    env.AUTH_DEFAULT_USER_ROLE === "admin"
      ? env.AUTH_DEFAULT_USER_ROLE
      : DEFAULT_PRODUCTION_ROLE

  // Derive group_ids from region for staff users
  const region = env.AUTH_DEFAULT_USER_REGION
  let group_ids: number[] | undefined
  if (role === 'staff' && region) {
    const groupId = getGroupIdByRegion(region as RegionValue)
    group_ids = [groupId]
  } else if (role === 'admin') {
    group_ids = [1, 2, 3, 4, 5, 6, 7, 8] // Admin has all groups
  }

  const user: MockUser = {
    id: `env-user-${email.replace(/[^a-zA-Z0-9]/g, "-") || "default"}`,
    email,
    role,
    full_name: env.AUTH_DEFAULT_USER_NAME || "Authenticated User",
    avatar_url: undefined,
    phone: undefined,
    language: "en",
    region,
    zammad_id: undefined,
    group_ids,
    created_at: new Date().toISOString(),
  }

  return { user, password }
}

/**
 * Authenticate user via Zammad API
 * @param email - User email
 * @param password - User password
 * @returns MockUser compatible object or null
 */
async function authenticateWithZammad(
  email: string,
  password: string
): Promise<MockUser | null> {
  try {
    console.log('[Auth] Attempting Zammad authentication for:', email)

    const zammadUser = await zammadClient.authenticateUser(email, password)

    if (!zammadUser) {
      console.log('[Auth] Zammad authentication failed for:', email)
      return null
    }

    console.log('[Auth] Zammad authentication successful for:', email, 'User ID:', zammadUser.id)

    // Convert Zammad user to our user format
    const role = getRoleFromZammad(zammadUser.role_ids || [])

    // Get region: Staff/Admin from group_ids, Customer from note field
    const region = role === 'customer'
      ? getRegionFromNote(zammadUser.note)
      : getRegionFromGroupIds(zammadUser.group_ids)

    console.log('[Auth] User role:', role, 'region:', region, 'note:', zammadUser.note?.substring(0, 50))

    const groupIds = extractGroupIds(zammadUser.group_ids)

    const user: MockUser = {
      id: `zammad-${zammadUser.id}`,
      email: zammadUser.email,
      role,
      full_name: `${zammadUser.firstname || ''} ${zammadUser.lastname || ''}`.trim() || zammadUser.login,
      avatar_url: zammadUser.image || undefined,
      phone: zammadUser.phone || undefined,
      language: zammadUser.preferences?.locale || 'en',
      region,
      zammad_id: zammadUser.id,
      group_ids: groupIds,
      created_at: zammadUser.created_at,
    }

    return user
  } catch (error) {
    console.error('[Auth] Zammad authentication error:', error)
    return null
  }
}

/**
 * Validate credentials using multiple authentication strategies:
 * 1. First try Zammad authentication (if configured)
 * 2. Then try mock users (if enabled)
 * 3. Finally try production env credentials
 */
async function validateCredentials(
  email: string,
  password: string
): Promise<MockUser | null> {
  const normalizedEmail = email.trim().toLowerCase()

  // Strategy 1: Try Zammad authentication first (if Zammad is configured)
  if (process.env.ZAMMAD_URL && process.env.ZAMMAD_API_TOKEN) {
    const zammadUser = await authenticateWithZammad(normalizedEmail, password)
    if (zammadUser) {
      console.log('[Auth] User authenticated via Zammad')
      return zammadUser
    }
    console.log('[Auth] Zammad auth failed, trying fallback methods...')
  }

  // Strategy 2: Try mock users (if mock auth is enabled)
  if (isMockAuthEnabled()) {
    const user = mockUsers[normalizedEmail]
    if (user) {
      const expectedPassword = mockPasswords[normalizedEmail]
      if (password === expectedPassword) {
        console.log('[Auth] User authenticated via mock auth')
        return user
      }
    }
    // In mock auth mode, if user not found in mock, still return null
    // (don't fall through to production credentials)
    console.log('[Auth] Mock auth: user not found or password mismatch')
    return null
  }

  // Strategy 3: Try production credentials from env
  const productionCredentials = getProductionUserFromEnv()

  if (!productionCredentials) {
    console.log('[Auth] No authentication method available')
    throw new Error("AUTH_CONFIG_MISSING")
  }

  const { user: productionUser, password: productionPassword } = productionCredentials

  if (normalizedEmail !== productionUser.email.toLowerCase()) {
    return null
  }

  if (password !== productionPassword) {
    return null
  }

  console.log('[Auth] User authenticated via env credentials')
  return productionUser
}

const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        const user = await validateCredentials(email, password)
        if (!user) {
          return null
        }

        // Return user object compatible with NextAuth
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          phone: user.phone,
          language: user.language,
          region: user.region,
          zammad_id: user.zammad_id,
          group_ids: user.group_ids,
        }
      },
    }),
  ],

  callbacks: {
    // Persist user data to JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = user.role
        token.full_name = user.full_name
        token.avatar_url = user.avatar_url
        token.phone = user.phone
        token.language = user.language
        token.region = user.region
        token.zammad_id = user.zammad_id
        token.group_ids = user.group_ids
      }
      return token
    },

    // Make user data available in session
    async session({ session, token }) {
      if (token) {
        // @ts-expect-error - We're extending the session type
        session.user = {
          id: (token.id as string) || (token.sub as string) || "",
          email: (token.email as string) || "",
          role: (token.role as "customer" | "staff" | "admin") || "customer",
          full_name: (token.full_name as string) || "",
          avatar_url: token.avatar_url as string | undefined,
          phone: token.phone as string | undefined,
          language: token.language as string | undefined,
          region: token.region as string | undefined,
          zammad_id: token.zammad_id as number | undefined,
          group_ids: token.group_ids as number[] | undefined,
        }
      }
      return session
    },

    // Control route access via middleware
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      // Allow public routes and static assets (uses shared route constants)
      if (isRouteMatch(pathname, PUBLIC_ROUTES) || isRouteMatch(pathname, STATIC_ROUTES)) {
        return true
      }

      // API routes that need special handling
      if (pathname.startsWith("/api/")) {
        // Dev endpoints only in development
        if (pathname.startsWith("/api/dev/")) {
          return process.env.NODE_ENV !== "production"
        }
        // Other API routes require authentication
        return isLoggedIn
      }

      // Protected portal routes
      if (pathname.startsWith("/admin")) {
        return isLoggedIn && auth?.user?.role === "admin"
      }

      if (pathname.startsWith("/staff")) {
        return (
          isLoggedIn &&
          (auth?.user?.role === "staff" || auth?.user?.role === "admin")
        )
      }

      if (pathname.startsWith("/customer")) {
        return isLoggedIn
      }

      // Default: require authentication for other routes
      return isLoggedIn
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // Secret for JWT signing
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,

  // Trust host header (required for reverse proxy/frp)
  trustHost: true,

  // Disable secure cookies for HTTP proxy (frp)
  // When false, cookies work over HTTP (not just HTTPS)
  useSecureCookies: false,

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
