/**
 * Authentication Utilities
 *
 * Server-side utilities for authentication using NextAuth.js v5
 * Use these utilities in API routes and server components
 */

import { auth } from "@/auth"
import type { Session } from "next-auth"

// Re-export the User type from NextAuth
export type { User } from "next-auth"

/**
 * User type for backward compatibility with existing code
 */
export interface AuthUser {
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
  created_at?: string
}

/**
 * Get the current session (server-side)
 * Works in API routes and server components
 */
export async function getSession(): Promise<Session | null> {
  return await auth()
}

/**
 * Get the current user (server-side)
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth()
  if (!session?.user) {
    return null
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    full_name: session.user.full_name,
    avatar_url: session.user.avatar_url,
    phone: session.user.phone,
    language: session.user.language,
    region: session.user.region,
    zammad_id: session.user.zammad_id,
    created_at: new Date().toISOString(),
  }
}

/**
 * Require authentication - throws error if not authenticated
 * Use in API routes to protect endpoints
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  return user
}

/**
 * Get user role
 */
export async function getUserRole(
  _userId?: string
): Promise<"customer" | "staff" | "admin"> {
  const user = await getCurrentUser()

  if (!user) {
    return "customer" // Default role
  }

  return user.role
}

/**
 * Require specific role(s) - throws error if user doesn't have required role
 */
export async function requireRole(
  allowedRoles: ("customer" | "staff" | "admin")[]
): Promise<AuthUser> {
  const user = await requireAuth()

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden")
  }

  return user
}

/**
 * Check if user is admin
 */
export async function isAdmin(_userId?: string): Promise<boolean> {
  const role = await getUserRole(_userId)
  return role === "admin"
}

/**
 * Check if user is staff (or admin)
 */
export async function isStaff(_userId?: string): Promise<boolean> {
  const role = await getUserRole(_userId)
  return role === "staff" || role === "admin"
}

/**
 * Check if mock authentication is enabled
 */
export function isMockAuthEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true
  }
  return process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true"
}
