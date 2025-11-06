'use client'

import CustomerLayout from '@/components/layouts/customer-layout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CustomerLayout>{children}</CustomerLayout>
}

