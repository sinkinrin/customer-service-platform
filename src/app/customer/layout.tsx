/**
 * Customer Layout (Parenthesized Route Group)
 *
 * Layout for customer-facing pages with authentication protection
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
    router.push('/auth/login')
  }

  return (
    <ProtectedRoute requiredRoles={['customer', 'staff', 'admin']}>
      <CustomerLayout
        user={user ? {
          id: user.id,
          email: user.email || '',
          name: user.full_name || undefined,
          avatar: user.avatar_url || undefined,
          role: userRole || 'customer',
        } : undefined}
        onLogout={handleLogout}
      >
        {children}
      </CustomerLayout>
    </ProtectedRoute>
  )
}
