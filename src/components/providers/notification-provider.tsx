"use client"

import { useNotifications } from '@/lib/hooks/use-notifications'

/**
 * NotificationProvider
 *
 * Polls notification data so that NotificationCenter (bell dropdown) stays
 * up-to-date.  Toast alerts are handled by TicketUpdatesProvider via SSE,
 * so this provider intentionally does NOT show toasts.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  // Keep polling alive so NotificationCenter and unreadCount stay fresh
  useNotifications({ pollIntervalMs: 15000 })

  return <>{children}</>
}
