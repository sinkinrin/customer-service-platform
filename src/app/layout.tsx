/**
 * Root Layout
 *
 * Root layout for the Customer Service Platform
 */

import type { Metadata } from 'next'
import './globals.css'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Customer Service Platform',
  description: 'AI-powered customer service platform with Supabase and Zammad integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={cn("min-h-screen bg-background font-sans antialiased overflow-x-hidden")}>
        {children}
      </body>
    </html>
  )
}
