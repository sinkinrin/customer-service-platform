'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import {
  claimTicketUpdateForProcessing,
  useTicketUpdates,
  TicketUpdate,
} from '@/lib/hooks/use-ticket-updates'
import { useTicketSSE } from '@/lib/hooks/use-ticket-sse'
import { useUnreadStore } from '@/lib/stores/unread-store'
import { useAuth } from '@/lib/hooks/use-auth'
import { getAuthorizationIdentityKey } from '@/lib/auth/authorization-identity'
import { useTranslations } from 'next-intl'

interface TicketUpdatesProviderProps {
  children: React.ReactNode
}

type TicketToastOptions = NonNullable<Parameters<typeof toast.info>[1]>

const MAX_LOCAL_UPDATE_IDS_PER_IDENTITY = 500
const MAX_LOCAL_UPDATE_IDENTITIES = 4
const locallyProcessedTicketUpdates = new Map<string, Set<string>>()

function claimLocalTicketUpdate(
  registries: Map<string, Set<string>>,
  identityKey: string,
  updateId: string
): boolean {
  let updateIds = registries.get(identityKey)

  if (!updateIds) {
    updateIds = new Set<string>()
    registries.set(identityKey, updateIds)

    if (registries.size > MAX_LOCAL_UPDATE_IDENTITIES) {
      const oldestIdentityKey = registries.keys().next().value
      if (oldestIdentityKey !== undefined && oldestIdentityKey !== identityKey) {
        registries.delete(oldestIdentityKey)
      }
    }
  } else {
    // Keep recently active identities at the end of the bounded registry.
    registries.delete(identityKey)
    registries.set(identityKey, updateIds)
  }

  if (!updateId) return true
  if (updateIds.has(updateId)) return false

  updateIds.add(updateId)
  if (updateIds.size > MAX_LOCAL_UPDATE_IDS_PER_IDENTITY) {
    const oldestUpdateId = updateIds.values().next().value
    if (oldestUpdateId !== undefined) {
      updateIds.delete(oldestUpdateId)
    }
  }

  return true
}

function isTicketRealtimeRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/customer/my-tickets') ||
    pathname.startsWith('/staff/tickets') ||
    pathname.startsWith('/admin/tickets')
  )
}

export function TicketUpdatesProvider({ children }: TicketUpdatesProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const tToast = useTranslations('toast.tickets')
  const { incrementCount } = useUnreadStore()
  const { mutate } = useSWRConfig()
  const realtimeIdentityKey = getAuthorizationIdentityKey(user)
  const currentRealtimeIdentityKeyRef = useRef(realtimeIdentityKey)
  const ticketToastIdsRef = useRef<Set<string | number>>(new Set())
  currentRealtimeIdentityKeyRef.current = realtimeIdentityKey

  const showTicketToast = useCallback((message: React.ReactNode, options: TicketToastOptions) => {
    const toastReference: { id?: string | number } = {}
    const forgetToast = () => {
      if (toastReference.id !== undefined) {
        ticketToastIdsRef.current.delete(toastReference.id)
      }
    }

    const toastId = toast.info(message, {
      ...options,
      onDismiss: forgetToast,
      onAutoClose: forgetToast,
    })
    toastReference.id = toastId
    ticketToastIdsRef.current.add(toastId)
  }, [])

  // Only dismiss notifications created by this provider. Identity changes and
  // unmounts must not leave an old user's ticket action visible or clickable.
  useEffect(() => {
    const ticketToastIds = ticketToastIdsRef.current

    return () => {
      const toastIds = [...ticketToastIds]
      ticketToastIds.clear()
      toastIds.forEach((toastId) => toast.dismiss(toastId))
    }
  }, [realtimeIdentityKey])

  // SSE connection state
  const [sseConnected, setSSEConnected] = useState(false)
  const [sseFailed, setSSEFailed] = useState(false)
  const updatesEnabled = !!user && isTicketRealtimeRoute(pathname)

  useEffect(() => {
    setSSEConnected(false)
    setSSEFailed(false)
  }, [realtimeIdentityKey])

  // Process a single update (used by both SSE and polling)
  const processUpdate = useCallback(async (update: TicketUpdate) => {
    const expectedUserId = user?.id
    const expectedUserRole = user?.role
    const expectedRealtimeIdentityKey = realtimeIdentityKey
    const isExpectedIdentityCurrent = () =>
      currentRealtimeIdentityKeyRef.current === expectedRealtimeIdentityKey

    // Callbacks owned by a previous SSE/polling identity can still be invoked
    // while React is replacing their subscriptions. Never let them claim or
    // process an update for the next signed-in user.
    if (
      !expectedUserId ||
      !expectedRealtimeIdentityKey ||
      !isExpectedIdentityCurrent()
    ) {
      return
    }

    // Every tab must refresh its own caches and manual-fetch pages. Deduplicate
    // SSE/polling delivery locally before consulting the cross-tab registry.
    const shouldProcessLocally = claimLocalTicketUpdate(
      locallyProcessedTicketUpdates,
      expectedRealtimeIdentityKey,
      update.id
    )

    if (shouldProcessLocally) {
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

      // Keep the deprecated per-tab unread store synchronized even when another
      // tab owns the global toast claim.
      if (update.event === 'article_created' || update.event === 'status_changed') {
        incrementCount(update.ticketId)
      }
    }

    // The persistent claim only gates cross-tab one-time effects such as
    // toasts. Local cache refresh and events above must happen in every tab.
    if (!(
      await claimTicketUpdateForProcessing(
        update.id,
        expectedUserId,
        isExpectedIdentityCurrent
      )
    )) {
      return
    }

    // Web Locks may have queued the claim behind another tab. Re-check the
    // active identity before any visible or navigational side effect.
    if (!isExpectedIdentityCurrent()) {
      return
    }

    // Handle different event types
    if (update.event === 'article_created') {
      showTicketToast(
        tToast('newReply', { ticketId: update.ticketId }),
        {
          description: update.data?.senderEmail || tToast('newMessage'),
          action: {
            label: tToast('view'),
            onClick: () => {
              if (
                currentRealtimeIdentityKeyRef.current !== expectedRealtimeIdentityKey
              ) {
                return
              }

              const basePath = expectedUserRole === 'admin'
                ? '/admin/tickets'
                : expectedUserRole === 'staff'
                  ? '/staff/tickets'
                  : '/customer/my-tickets'
              router.push(`${basePath}/${update.ticketId}`)
            },
          },
          duration: 5000,
        }
      )
    } else if (update.event === 'created') {
      showTicketToast(
        tToast('newTicket', { ticketId: update.ticketId }),
        {
          description: update.data?.title || tToast('newTicketDescription'),
          action: {
            label: tToast('view'),
            onClick: () => {
              if (
                currentRealtimeIdentityKeyRef.current !== expectedRealtimeIdentityKey
              ) {
                return
              }

              const basePath = expectedUserRole === 'admin'
                ? '/admin/tickets'
                : expectedUserRole === 'staff'
                  ? '/staff/tickets'
                  : '/customer/my-tickets'
              router.push(`${basePath}/${update.ticketId}`)
            },
          },
          duration: 5000,
        }
      )
    }
  }, [incrementCount, mutate, realtimeIdentityKey, router, showTicketToast, user?.id, user?.role, tToast])

  // Handle updates from polling (batch)
  const handlePollingUpdates = useCallback((updates: TicketUpdate[]) => {
    updates.forEach((update) => {
      void processUpdate(update)
    })
  }, [processUpdate])

  // SSE callbacks
  const handleSSEUpdate = useCallback((update: TicketUpdate) => {
    console.log('[Provider] SSE update received:', update.id)
    void processUpdate(update)
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
    enabled: updatesEnabled && !sseFailed,
    subscriptionKey: realtimeIdentityKey,
    onUpdate: handleSSEUpdate,
    onConnectionChange: handleSSEConnectionChange,
    onError: handleSSEError,
  })

  // Keep persistent polling active as a cross-instance backup. The SSE emitter
  // is process-local, so a healthy connection can still miss a webhook handled
  // by another application instance.
  useTicketUpdates({
    enabled: updatesEnabled,
    onUpdate: handlePollingUpdates,
    userId: user?.id,
    identityKey: realtimeIdentityKey,
  })

  // Log mode on mount/change
  useEffect(() => {
    if (!updatesEnabled) return
    if (sseConnected) {
      console.log('[Provider] Mode: SSE (real-time)')
    } else if (sseFailed) {
      console.log('[Provider] Mode: Polling (SSE failed)')
    } else {
      console.log('[Provider] Mode: Connecting SSE...')
    }
  }, [updatesEnabled, sseConnected, sseFailed])

  return <>{children}</>
}
