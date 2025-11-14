/**
 * Protected Route Component
 * 
 * Wrapper component that requires authentication to access
 */

"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
  requiredRole?: 'customer' | 'staff' | 'admin'
  requiredRoles?: ('customer' | 'staff' | 'admin')[]
}

export function ProtectedRoute({
  children,
  redirectTo = '/auth/login',
  requiredRole,
  requiredRoles,
}: ProtectedRouteProps) {
  const router = useRouter()
  const { isLoading, isAuthenticated, userRole, user, getUserRole } = useAuth()
  const [loadingTimeoutReached, setLoadingTimeoutReached] = useState(false)
  const [inferredRole, setInferredRole] = useState<'customer' | 'staff' | 'admin' | null>(null)

  useEffect(() => {
    if (!isLoading) return
    const t = setTimeout(() => setLoadingTimeoutReached(true), 2500)
    return () => clearTimeout(t)
  }, [isLoading])

  // Check authentication
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isLoading, isAuthenticated, router, redirectTo])

  // Ensure role is available (dev-friendly) if user is authenticated but role not yet in store
  useEffect(() => {
    const load = async () => {
      if (isAuthenticated && user && !userRole) {
        // Fast path in dev: infer from test account emails without network
        const email = user.email?.toLowerCase()
        if (process.env.NODE_ENV !== 'production' && email) {
          if (email === 'admin@test.com') { setInferredRole('admin'); return }
          if (email === 'staff@test.com') { setInferredRole('staff'); return }
          if (email === 'customer@test.com') { setInferredRole('customer'); return }
        }
        try {
          const role = await getUserRole(user.id)
          setInferredRole(role)
        } catch {
          setInferredRole('customer')
        }
      }
    }
    void load()
  }, [isAuthenticated, user, userRole, getUserRole])

  // Check if user role is allowed
  const isRoleAllowed = (): boolean => {
    const role = userRole ?? inferredRole
    if (!role) return false

    // If requiredRole is specified, check exact match
    if (requiredRole) {
      return role === requiredRole
    }

    // If requiredRoles is specified, check if user role is in the list
    if (requiredRoles && requiredRoles.length > 0) {
      return requiredRoles.includes(role)
    }

    // If no role requirements, allow access
    return true
  }

  // Show loading state while checking authentication
  if (isLoading && !isAuthenticated && !loadingTimeoutReached) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Check role-based access control
  // If role requirement exists but role is not yet available, keep showing loading instead of denying
  if ((requiredRole || requiredRoles) && isAuthenticated && !(userRole || inferredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    )
  }

  if ((requiredRole || requiredRoles) && !isRoleAllowed()) {
    const role = userRole ?? inferredRole
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have permission to access this page.
            {role && (
              <span className="block mt-2 text-sm">
                Your role: <span className="font-semibold capitalize">{role}</span>
              </span>
            )}
          </p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

