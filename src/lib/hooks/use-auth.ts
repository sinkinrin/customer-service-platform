/**
 * Authentication Hook
 *
 * TODO: Replace with real authentication system (e.g., NextAuth.js, Auth0, Clerk)
 * This is a temporary mock implementation to allow development without Supabase
 */

"use client"

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'
import { mockSignIn, mockSignUp, mockSignOut, mockGetUser, mockGetSession } from '@/lib/mock-auth'
import { logDebug, logInfo, logError } from '@/lib/utils/logger'

export function useAuth() {
  const router = useRouter()

  const {
    user,
    session,
    userRole,
    isLoading,
    isInitialized,
    setUser,
    setSession,
    setUserRole,
    setLoading,
    setInitialized,
    reset,
  } = useAuthStore()

  // Get user role from mock user
  const getUserRole = useCallback(async (userId: string): Promise<'customer' | 'staff' | 'admin'> => {
    try {
      logDebug('Auth', `Fetching user role for user: ${userId}`)

      // TODO: Replace with real database query
      const mockUser = await mockGetUser()
      if (!mockUser) {
        return 'customer' // Default role
      }

      logInfo('Auth', `User role fetched successfully: ${mockUser.role}`)
      return mockUser.role
    } catch (error) {
      logError('Auth', 'Exception while fetching user role', error)
      return 'customer' // Default role
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    if (isInitialized) return

    const initAuth = async () => {
      try {
        setLoading(true)

        // TODO: Replace with real session check
        const mockSession = await mockGetSession()

        if (mockSession) {
          setSession(mockSession)
          setUser(mockSession.user)

          // Fetch and set user role
          const role = await getUserRole(mockSession.user.id)
          setUserRole(role)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    initAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized])

  // Safety guard: if store got rehydrated with isInitialized=true but isLoading stuck
  useEffect(() => {
    if (isInitialized && isLoading) {
      setLoading(false)
    }
  }, [isInitialized, isLoading, setLoading])

  // Failsafe: avoid indefinite spinner if initAuth fails to resolve
  useEffect(() => {
    if (!isInitialized && isLoading) {
      const t = setTimeout(() => setLoading(false), 2000)
      return () => clearTimeout(t)
    }
  }, [isInitialized, isLoading, setLoading])


  // Sign in with email and password
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        logInfo('Auth', `Sign in attempt for: ${email}`)
        setLoading(true)

        // TODO: Replace with real authentication
        const { user, session, error } = await mockSignIn(email, password)

        if (error) throw error

        if (session) {
          setSession(session)
          setUser(user)

          // Fetch and set user role
          const role = await getUserRole(user.id)
          setUserRole(role)

          logInfo('Auth', `Sign in successful for: ${email}, role: ${role}`)
        }

        return { data: { user, session }, error: null }
      } catch (err) {
        const error = err as Error
        logError('Auth', `Sign in failed for: ${email}`, error)
        return { data: null, error }
      } finally {
        setLoading(false)
      }
    },
    [setSession, setUser, setUserRole, setLoading, getUserRole]
  )

  // Sign up with email and password
  const signUp = useCallback(
    async (email: string, password: string, metadata?: { full_name?: string }) => {
      try {
        setLoading(true)

        // TODO: Replace with real authentication
        const { user, session, error } = await mockSignUp(email, password, metadata)

        if (error) throw error

        return { data: { user, session }, error: null }
      } catch (err) {
        const error = err as Error
        console.error('Sign up error:', error)
        return { data: null, error }
      } finally {
        setLoading(false)
      }
    },
    [setLoading]
  )

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setLoading(true)

      // TODO: Replace with real authentication
      const { error } = await mockSignOut()
      if (error) throw error

      reset()
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }, [reset, router, setLoading])

  // Reset password
  const resetPassword = useCallback(
    async (_email: string) => {
      try {
        setLoading(true)

        // TODO: Replace with real password reset
        // For now, just return success
        return { error: null }
      } catch (err) {
        const error = err as Error
        console.error('Reset password error:', error)
        return { error }
      } finally {
        setLoading(false)
      }
    },
    [setLoading]
  )

  // Update password
  const updatePassword = useCallback(
    async (_newPassword: string) => {
      try {
        setLoading(true)

        // TODO: Replace with real password update
        // For now, just return success
        return { error: null }
      } catch (err) {
        const error = err as Error
        console.error('Update password error:', error)
        return { error }
      } finally {
        setLoading(false)
      }
    },
    [setLoading]
  )

  // Get user profile
  const getUserProfile = useCallback(async () => {
    if (!user) return null

    try {
      // TODO: Replace with real database query
      return user
    } catch (error) {
      console.error('Get user profile error:', error)
      return null
    }
  }, [user])

  return {
    user,
    session,
    userRole,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    getUserProfile,
    getUserRole,
  }
}

