'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { useTicketUpdates, TicketUpdate } from '@/lib/hooks/use-ticket-updates'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTranslations } from 'next-intl'

interface TicketUpdatesProviderProps {
  children: React.ReactNode
}

export function TicketUpdatesProvider({ children }: TicketUpdatesProviderProps) {
  const router = useRouter()
  const { user } = useAuth()
  const tToast = useTranslations('toast.tickets')
  const { incrementCount } = useUnreadStore()
  const { mutate } = useSWRConfig()

  // Handle updates received from polling
  const handleUpdate = useCallback((updates: TicketUpdate[]) => {
    if (updates.length === 0) return

    // Revalidate ticket list data when updates are received
    mutate(
      (key) => typeof key === 'string' && key.startsWith('/api/tickets'),
      undefined,
      { revalidate: true }
    )

    updates.forEach((update) => {
      // Only show notifications for article_created events
      if (update.event === 'article_created') {
        // Increment unread count
        incrementCount(update.ticketId)

        // Show toast notification
        toast.info(
          tToast('newReply', { ticketId: update.ticketId }),
          {
            description: update.data?.senderEmail || tToast('newMessage'),
            action: {
              label: tToast('view'),
              onClick: () => {
                const basePath = user?.role === 'admin' 
                  ? '/admin/tickets' 
                  : user?.role === 'staff' 
                    ? '/staff/tickets'
                    : '/customer/my-tickets'
                router.push(`${basePath}/${update.ticketId}`)
              },
            },
            duration: 5000,
          }
        )
      } else if (update.event === 'status_changed') {
        // For status changes, just mark as unread without toast
        incrementCount(update.ticketId)
      } else if (update.event === 'created') {
        // For new tickets, show toast notification
        toast.info(
          tToast('newTicket', { ticketId: update.ticketId }),
          {
            description: update.data?.title || tToast('newTicketDescription'),
            action: {
              label: tToast('view'),
              onClick: () => {
                const basePath = user?.role === 'admin' 
                  ? '/admin/tickets' 
                  : user?.role === 'staff' 
                    ? '/staff/tickets'
                    : '/customer/my-tickets'
                router.push(`${basePath}/${update.ticketId}`)
              },
            },
            duration: 5000,
          }
        )
      }
    })
  }, [incrementCount, mutate, router, user?.role])

  // Enable polling only if user is logged in
  useTicketUpdates({
    enabled: !!user,
    onUpdate: handleUpdate,
  })

  return <>{children}</>
}
