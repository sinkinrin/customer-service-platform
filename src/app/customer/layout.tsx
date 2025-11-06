/**
 * Customer Layout
 * 
 * Layout for customer-facing pages
 */

'use client'

import { useRouter } from 'next/navigation'
import { CustomerLayout } from '@/components/layouts/customer-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/lib/hooks/use-auth'

export default function CustomerLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, userRole, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <ProtectedRoute requiredRoles={['customer']}>
      <CustomerLayout
        user={user ? {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || undefined,
          avatar: user.user_metadata?.avatar_url || undefined,
          role: userRole || 'customer',
        } : undefined}
        onLogout={handleLogout}
      >
        {children}
      </CustomerLayout>
    </ProtectedRoute>
  )
}

