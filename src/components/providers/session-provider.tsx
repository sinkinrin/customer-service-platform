"use client"

/**
 * NextAuth Session Provider
 *
 * Wraps the application with NextAuth's SessionProvider
 * to enable client-side session access via useSession hook
 * Also syncs NextAuth session state to Zustand auth store
 */

import { useEffect } from "react"
import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react"
import type { Session } from "next-auth"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useConversationStore } from "@/lib/stores/conversation-store"
import { useUnreadStore } from "@/lib/stores/unread-store"

interface SessionProviderProps {
  children: React.ReactNode
  session?: Session | null
}

/**
 * Component that syncs NextAuth session to Zustand auth store
 * This ensures components using useAuthStore get updated user data
 */
function AuthStoreSync({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { setUser, setSession, setUserRole, setLoading, setInitialized } = useAuthStore()
  const { resetForUser } = useUnreadStore()
  const { resetForUser: resetConversationsForUser } = useConversationStore()

  useEffect(() => {
    // Update loading state
    setLoading(status === "loading")

    if (status === "loading") {
      return
    }

    // Mark as initialized once we have a definitive status
    setInitialized(true)

    if (status === "authenticated" && session?.user) {
      resetForUser(session.user.id)
      resetConversationsForUser(session.user.id)
      // Sync user data to Zustand store
      const user = {
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
      setUser(user)
      // Use real session expiry from NextAuth (session.expires is an ISO date string)
      // Token fields are omitted as NextAuth uses JWT-based sessions
      const expiresAt = session.expires
        ? new Date(session.expires).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000
      setSession({
        user,
        expires_at: expiresAt,
      })
      setUserRole(session.user.role)
    } else {
      resetForUser(null)
      resetConversationsForUser(null)
      // Clear auth store on sign out
      setUser(null)
      setSession(null)
      setUserRole(null)
    }
  }, [session, status, setUser, setSession, setUserRole, setLoading, setInitialized, resetForUser, resetConversationsForUser])

  return <>{children}</>
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      session={session}
      // Optimize session fetching: disable window focus refetch, keep default no-polling
      // refetchInterval defaults to 0 (no polling) which is correct with SSR session injection
      refetchOnWindowFocus={false}
    >
      <AuthStoreSync>{children}</AuthStoreSync>
    </NextAuthSessionProvider>
  )
}
