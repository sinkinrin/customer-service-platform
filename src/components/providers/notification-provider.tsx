"use client"

/**
 * NotificationProvider
 *
 * NotificationCenter and layouts fetch notification data directly. This wrapper
 * remains for layout compatibility without adding a duplicate global poll.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
