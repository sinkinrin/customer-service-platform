'use client'

import { useRouter } from 'next/navigation'
import { StaffLayout } from '@/components/layouts/staff-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/lib/hooks/use-auth'

export default function StaffRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <ProtectedRoute requiredRoles={['staff', 'admin']}>
      <StaffLayout
        user={{
          id: user?.id || '',
          email: user?.email || '',
          name: user?.full_name || undefined,
          avatar: user?.avatar_url || undefined,
          role: 'staff',
        }}
        onLogout={handleLogout}
      >
        {children}
      </StaffLayout>
    </ProtectedRoute>
  )
}

