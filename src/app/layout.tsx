/**
 * Root Layout
 *
 * Root layout for the Customer Service Platform
 * Includes NextAuth SessionProvider and NextIntl for internationalization
 */

import type { Metadata } from "next"
import "./globals.css"
import { cn } from "@/lib/utils"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { SessionProvider } from "@/components/providers/session-provider"
import { TicketUpdatesProvider } from "@/components/providers/ticket-updates-provider"
import { NotificationProvider } from "@/components/providers/notification-provider"
import { ensureEnvValidation } from "@/lib/env"
import { auth } from "@/auth"

export const metadata: Metadata = {
  title: "Customer Service Platform",
  description:
    "AI-powered customer service platform with Supabase and Zammad integration",
  icons: {
    icon: "/logo-with-bg.svg",
    shortcut: "/logo-with-bg.svg",
    apple: "/logo-with-bg.svg",
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  ensureEnvValidation({ strict: false })

  // Get session server-side to avoid client refetch
  const session = await auth()
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased overflow-x-hidden"
        )}
        suppressHydrationWarning
      >
        <SessionProvider session={session}>
          <NextIntlClientProvider messages={messages}>
            <TicketUpdatesProvider>
              <NotificationProvider>
                {children}
              </NotificationProvider>
            </TicketUpdatesProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
