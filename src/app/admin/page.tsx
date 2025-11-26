'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoader } from '@/components/ui/page-loader'

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
    <PageLoader
      message="Redirecting to dashboard..."
      hint="Loading the admin workspace"
    />
  )
}

