'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Admin Root Page
 * Redirects to /admin/dashboard
 */
export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}

