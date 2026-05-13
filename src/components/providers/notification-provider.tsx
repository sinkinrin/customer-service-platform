"use client"

import { usePathname } from 'next/navigation'
import { useNotifications } from '@/lib/hooks/use-notifications'

function isNotificationRoute(pathname: string): boolean {
  if (pathname.startsWith('/customer/conversations')) return false
  return (
    pathname.startsWith('/customer') ||
    pathname.startsWith('/staff') ||
    pathname.startsWith('/admin')
  )
}

/**
 * NotificationProvider
 *
 * Polls notification data so that NotificationCenter (bell dropdown) stays
 * up-to-date.  Toast alerts are handled by TicketUpdatesProvider via SSE,
 * so this provider intentionally does NOT show toasts.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const enabled = isNotificationRoute(pathname)

  // Keep polling alive so NotificationCenter and unreadCount stay fresh
  useNotifications({ pollIntervalMs: 15000, enabled })

  return <>{children}</>
}
