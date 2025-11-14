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
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <AdminLayout
        user={user ? {
          id: user.id,
          email: user.email || '',
          name: user.full_name || undefined,
          avatar: user.avatar_url || undefined,
        } : undefined}
        onLogout={handleLogout}
      >
        {children}
      </AdminLayout>
    </ProtectedRoute>
  )
}

