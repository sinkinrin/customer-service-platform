/**
 * NextAuth.js v5 Configuration
 *
 * This configuration supports both:
 * - Development mode: Mock credentials authentication
 * - Production mode: Real authentication (credentials or OAuth)
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

// Import mock auth for development mode
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
    }
  }
}

const DEFAULT_PRODUCTION_ROLE: MockUser["role"] = "staff"

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

  const user: MockUser = {
    id: `env-user-${email.replace(/[^a-zA-Z0-9]/g, "-") || "default"}`,
    email,
    role,
    full_name: env.AUTH_DEFAULT_USER_NAME || "Authenticated User",
    avatar_url: undefined,
    phone: undefined,
    language: "en",
    region: env.AUTH_DEFAULT_USER_REGION,
    zammad_id: undefined,
    created_at: new Date().toISOString(),
  }

  return { user, password }
}

/**
 * Validate credentials against mock users (development) or real authentication (production)
 */
async function validateCredentials(
  email: string,
  password: string
): Promise<MockUser | null> {
  const normalizedEmail = email.trim().toLowerCase()

  // In development or when mock auth is enabled, use mock users
  if (isMockAuthEnabled()) {
    const user = mockUsers[normalizedEmail]
    if (!user) {
      return null
    }

    const expectedPassword = mockPasswords[normalizedEmail]
    if (password !== expectedPassword) {
      return null
    }

    return user
  }

  // In production without mock auth, implement real authentication here
  const productionCredentials = getProductionUserFromEnv()

  if (!productionCredentials) {
    throw new Error(
      "AUTH_CONFIG_MISSING"
    )
  }

  const { user: productionUser, password: productionPassword } = productionCredentials

  if (normalizedEmail !== productionUser.email.toLowerCase()) {
    return null
  }

  if (password !== productionPassword) {
    return null
  }

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

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
