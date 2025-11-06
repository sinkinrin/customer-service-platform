"use client"

import { useAuth } from '@/lib/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { AdminLayout } from '@/components/layouts/admin-layout'

export default function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, userRole, signOut } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminLayout
        user={user ? {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || undefined,
          avatar: user.user_metadata?.avatar_url || undefined,
          role: userRole || 'admin',
        } : undefined}
        onLogout={handleLogout}
      >
        {children}
      </AdminLayout>
    </ProtectedRoute>
  )
}

