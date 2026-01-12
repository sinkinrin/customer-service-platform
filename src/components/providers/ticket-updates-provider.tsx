'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { useTicketUpdates, TicketUpdate } from '@/lib/hooks/use-ticket-updates'
import { useTicketSSE } from '@/lib/hooks/use-ticket-sse'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTranslations } from 'next-intl'

interface TicketUpdatesProviderProps {
  children: React.ReactNode
}

// Deduplication: track recently processed update IDs
const processedUpdates = new Set<string>()
const DEDUP_WINDOW_MS = 60000 // 1 minute

function markProcessed(id: string) {
  processedUpdates.add(id)
  setTimeout(() => processedUpdates.delete(id), DEDUP_WINDOW_MS)
}

export function TicketUpdatesProvider({ children }: TicketUpdatesProviderProps) {
  const router = useRouter()
  const { user } = useAuth()
  const tToast = useTranslations('toast.tickets')
  const { incrementCount } = useUnreadStore()
  const { mutate } = useSWRConfig()

  // SSE connection state
  const [sseConnected, setSSEConnected] = useState(false)
  const [sseFailed, setSSEFailed] = useState(false)

  // Process a single update (used by both SSE and polling)
  const processUpdate = useCallback((update: TicketUpdate) => {
    // Deduplicate: skip if already processed
    if (processedUpdates.has(update.id)) {
      return
    }
    markProcessed(update.id)

    // Revalidate ticket list data
    mutate(
      (key) => typeof key === 'string' && key.startsWith('/api/tickets'),
      undefined,
      { revalidate: true }
    )

    // Revalidate notifications data
    mutate(
      (key) => typeof key === 'string' && key.startsWith('/api/notifications'),
      undefined,
      { revalidate: true }
    )

    // Dispatch custom event for ticket detail pages to refresh
    // This is needed because some pages use manual fetch instead of SWR
    window.dispatchEvent(new CustomEvent('ticket-update', {
      detail: {
        ticketId: update.ticketId,
        event: update.event,
        data: update.data,
      }
    }))

    // Handle different event types
    if (update.event === 'article_created') {
      incrementCount(update.ticketId)

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
      incrementCount(update.ticketId)
    } else if (update.event === 'created') {
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
  }, [incrementCount, mutate, router, user?.role, tToast])

  // Handle updates from polling (batch)
  const handlePollingUpdates = useCallback((updates: TicketUpdate[]) => {
    updates.forEach(processUpdate)
  }, [processUpdate])

  // SSE callbacks
  const handleSSEUpdate = useCallback((update: TicketUpdate) => {
    console.log('[Provider] SSE update received:', update.id)
    processUpdate(update)
  }, [processUpdate])

  const handleSSEConnectionChange = useCallback((connected: boolean) => {
    console.log('[Provider] SSE connection:', connected)
    setSSEConnected(connected)
    if (connected) {
      setSSEFailed(false)
    }
  }, [])

  const handleSSEError = useCallback(() => {
    console.log('[Provider] SSE failed, falling back to polling')
    setSSEFailed(true)
    setSSEConnected(false)
  }, [])

  // Use SSE as primary, with auto-fallback to polling
  useTicketSSE({
    enabled: !!user && !sseFailed,
    onUpdate: handleSSEUpdate,
    onConnectionChange: handleSSEConnectionChange,
    onError: handleSSEError,
  })

  // Use polling as fallback when SSE is not connected or has failed
  // Also use polling with longer interval when SSE is connected (as backup)
  useTicketUpdates({
    enabled: !!user && (!sseConnected || sseFailed),
    onUpdate: handlePollingUpdates,
  })

  // Log mode on mount/change
  useEffect(() => {
    if (!user) return
    if (sseConnected) {
      console.log('[Provider] Mode: SSE (real-time)')
    } else if (sseFailed) {
      console.log('[Provider] Mode: Polling (SSE failed)')
    } else {
      console.log('[Provider] Mode: Connecting SSE...')
    }
  }, [user, sseConnected, sseFailed])

  return <>{children}</>
}
