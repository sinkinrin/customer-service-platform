/**
 * Root Layout
 *
 * Root layout for the Customer Service Platform
 */

import type { Metadata } from 'next'
import './globals.css'
import { cn } from '@/lib/utils'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Customer Service Platform',
  description: 'AI-powered customer service platform with Supabase and Zammad integration',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={cn("min-h-screen bg-background font-sans antialiased overflow-x-hidden")}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
