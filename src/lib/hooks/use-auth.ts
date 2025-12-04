/**
 * Authentication Hook
 *
 * Client-side authentication using NextAuth.js v5
 * Provides a unified interface for authentication operations
 */

"use client"

import { useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from "next-auth/react"
import { logInfo, logError } from "@/lib/utils/logger"

// User type matching NextAuth session
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
}

export function useAuth() {
  const router = useRouter()
  const { data: session, status, update } = useSession()

  const isLoading = status === "loading"
  const isAuthenticated = status === "authenticated"

  // Extract user from session
  const user: AuthUser | null = useMemo(() => {
    if (!session?.user) return null
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
    }
  }, [session])

  const userRole = user?.role || null

  // Get user role
  const getUserRole = useCallback(
    async (_userId?: string): Promise<"customer" | "staff" | "admin"> => {
      return userRole || "customer"
    },
    [userRole]
  )

  // Sign in with email and password
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        logInfo("Auth", `Sign in attempt for: ${email}`)

        const result = await nextAuthSignIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          const errorCode = result.error
          const friendlyMessage =
            errorCode === "CredentialsSignin"
              ? "Invalid email or password"
              : errorCode === "AUTH_CONFIG_MISSING" ||
                  errorCode?.includes("AUTH_CONFIG_MISSING")
                ? "Authentication is not configured. Set AUTH_DEFAULT_USER_EMAIL/PASSWORD or enable NEXT_PUBLIC_ENABLE_MOCK_AUTH."
                : errorCode || "Authentication failed"

          logError("Auth", `Sign in failed for: ${email}`, friendlyMessage)
          return {
            data: null,
            error: new Error(friendlyMessage),
          }
        }

        if (result?.ok) {
          logInfo("Auth", `Sign in successful for: ${email}`)
          // Trigger session update to fetch latest session/user data
          const updatedSession = await update()

          const updatedUser = updatedSession?.user
            ? ({
                id: updatedSession.user.id,
                email: updatedSession.user.email,
                role: updatedSession.user.role,
                full_name: updatedSession.user.full_name,
                avatar_url: updatedSession.user.avatar_url,
                phone: updatedSession.user.phone,
                language: updatedSession.user.language,
                region: updatedSession.user.region,
                zammad_id: updatedSession.user.zammad_id,
              } satisfies AuthUser)
            : null

          if (!updatedUser) {
            return {
              data: null,
              error: new Error("Login succeeded but session data was missing"),
            }
          }

          return { data: { user: updatedUser, session: updatedSession }, error: null }
        }

        return { data: null, error: new Error("Unknown authentication response") }
      } catch (err) {
        const error = err as Error
        logError("Auth", `Sign in exception for: ${email}`, error)
        return { data: null, error }
      }
    },
    [update]
  )

  // Sign up with email and password
  const signUp = useCallback(
    async (email: string, password: string, _metadata?: { full_name?: string }) => {
      try {
        // For now, sign up uses the same credentials flow
        // In production, you'd call an API to create the user first
        logInfo("Auth", `Sign up attempt for: ${email}`)

        // TODO: Implement actual user registration API
        // For now, just attempt to sign in (works with mock users)
        const result = await nextAuthSignIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          return { data: null, error: new Error(result.error) }
        }

        if (result?.ok) {
          const updatedSession = await update()

          const updatedUser = updatedSession?.user
            ? ({
                id: updatedSession.user.id,
                email: updatedSession.user.email,
                role: updatedSession.user.role,
                full_name: updatedSession.user.full_name,
                avatar_url: updatedSession.user.avatar_url,
                phone: updatedSession.user.phone,
                language: updatedSession.user.language,
                region: updatedSession.user.region,
                zammad_id: updatedSession.user.zammad_id,
              } satisfies AuthUser)
            : null

          return { data: { user: updatedUser, session: updatedSession }, error: null }
        }

        return { data: null, error: new Error("Sign up failed") }
      } catch (err) {
        const error = err as Error
        logError("Auth", `Sign up failed for: ${email}`, error)
        return { data: null, error }
      }
    },
    [update]
  )

  // Sign out
  const signOut = useCallback(async () => {
    try {
      logInfo("Auth", "Sign out initiated")
      await nextAuthSignOut({ redirect: false })
      router.push("/auth/login")
    } catch (error) {
      logError("Auth", "Sign out error", error)
    }
  }, [router])

  // Reset password
  const resetPassword = useCallback(async (_email: string) => {
    try {
      // TODO: Implement password reset API
      return { error: null }
    } catch (err) {
      const error = err as Error
      logError("Auth", "Reset password error", error)
      return { error }
    }
  }, [])

  // Update password
  const updatePassword = useCallback(async (_newPassword: string) => {
    try {
      // TODO: Implement password update API
      return { error: null }
    } catch (err) {
      const error = err as Error
      logError("Auth", "Update password error", error)
      return { error }
    }
  }, [])

  // Get user profile
  const getUserProfile = useCallback(async () => {
    return user
  }, [user])

  return {
    user,
    session,
    userRole,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    getUserProfile,
    getUserRole,
  }
}
