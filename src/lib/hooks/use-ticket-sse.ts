'use client'

import { useEffect, useRef, useState } from 'react'
import { TicketUpdate } from './use-ticket-updates'

interface UseTicketSSEOptions {
  enabled?: boolean
  subscriptionKey?: string | null
  onUpdate?: (update: TicketUpdate) => void
  onConnectionChange?: (connected: boolean) => void
  onError?: (error: Error) => void
}

interface UseTicketSSEReturn {
  isConnected: boolean
  error: string | null
  reconnectAttempts: number
}

// SSE reconnection config
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000] // Progressive backoff
const MAX_RECONNECT_ATTEMPTS = 10

export function useTicketSSE(options: UseTicketSSEOptions = {}): UseTicketSSEReturn {
  const {
    enabled = true,
    subscriptionKey,
    onUpdate,
    onConnectionChange,
    onError,
  } = options
  const connectionKey = `${enabled ? 'enabled' : 'disabled'}:${subscriptionKey ?? 'anonymous'}`

  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  // Use refs to avoid stale closures
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const enabledRef = useRef(enabled)
  const connectionKeyRef = useRef(connectionKey)
  const onUpdateRef = useRef(onUpdate)
  const onConnectionChangeRef = useRef(onConnectionChange)
  const onErrorRef = useRef(onError)

  // Render-time refs close the gap before passive effect cleanup. An event
  // from the previous identity is stale as soon as React renders the new key,
  // even if the old EventSource has not been closed yet.
  enabledRef.current = enabled
  connectionKeyRef.current = connectionKey
  onUpdateRef.current = onUpdate
  onConnectionChangeRef.current = onConnectionChange
  onErrorRef.current = onError

  useEffect(() => {
    const effectConnectionKey = connectionKey
    let effectEventSource: EventSource | null = null
    let effectReconnectTimeout: NodeJS.Timeout | null = null

    const isCurrentLifecycle = () =>
      enabledRef.current && connectionKeyRef.current === effectConnectionKey

    const clearEffectReconnectTimeout = () => {
      if (!effectReconnectTimeout) return

      clearTimeout(effectReconnectTimeout)
      if (reconnectTimeoutRef.current === effectReconnectTimeout) {
        reconnectTimeoutRef.current = null
      }
      effectReconnectTimeout = null
    }

    const closeEffectEventSource = () => {
      if (!effectEventSource) return

      const eventSource = effectEventSource
      effectEventSource = null
      eventSource.close()
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null
      }
    }

    if (!enabled) {
      setIsConnected(false)
      setError(null)
      reconnectAttemptsRef.current = 0
      setReconnectAttempts(0)
      return
    }

    setIsConnected(false)
    setError(null)
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)

    function connect() {
      // Don't connect if this effect belongs to an old identity, another
      // connection is active, or the subscription has been disabled.
      if (!isCurrentLifecycle() || eventSourceRef.current) return

      try {
        console.log('[SSE] Connecting...')
        const eventSource = new EventSource('/api/tickets/updates/stream')
        effectEventSource = eventSource
        eventSourceRef.current = eventSource

        const isCurrentConnection = () =>
          isCurrentLifecycle() &&
          effectEventSource === eventSource &&
          eventSourceRef.current === eventSource

        eventSource.onopen = () => {
          if (!isCurrentConnection()) return

          console.log('[SSE] Connected')
          setIsConnected(true)
          setError(null)
          reconnectAttemptsRef.current = 0
          setReconnectAttempts(0)
          onConnectionChangeRef.current?.(true)
        }

        eventSource.addEventListener('connected', (event) => {
          if (!isCurrentConnection()) return

          console.log('[SSE] Server confirmed connection:', event.data)
        })

        eventSource.addEventListener('ticket-update', (event) => {
          if (!isCurrentConnection()) return

          try {
            const update = JSON.parse(event.data) as TicketUpdate
            console.log('[SSE] Received update:', update.ticketId, update.event)
            onUpdateRef.current?.(update)
          } catch (parseError) {
            console.error('[SSE] Failed to parse update:', parseError)
          }
        })

        eventSource.onerror = () => {
          if (!isCurrentConnection()) return

          console.error('[SSE] Connection error')
          setIsConnected(false)
          onConnectionChangeRef.current?.(false)

          // Close the failed connection
          closeEffectEventSource()

          // Schedule reconnect if enabled and under max attempts
          if (isCurrentLifecycle() && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)]
            console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`)
            setError(`Connection lost. Reconnecting...`)

            const reconnectTimeout = setTimeout(() => {
              if (effectReconnectTimeout === reconnectTimeout) {
                effectReconnectTimeout = null
              }
              if (reconnectTimeoutRef.current === reconnectTimeout) {
                reconnectTimeoutRef.current = null
              }
              if (!isCurrentLifecycle()) return

              reconnectAttemptsRef.current++
              setReconnectAttempts(reconnectAttemptsRef.current)
              connect()
            }, delay)
            effectReconnectTimeout = reconnectTimeout
            reconnectTimeoutRef.current = reconnectTimeout
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setError('SSE connection failed. Using polling fallback.')
            onErrorRef.current?.(new Error('Max reconnect attempts exceeded'))
          }
        }
      } catch (err) {
        if (!isCurrentLifecycle()) return

        console.error('[SSE] Failed to create EventSource:', err)
        setError('Failed to establish SSE connection')
        onErrorRef.current?.(err instanceof Error ? err : new Error('Unknown SSE error'))
      }
    }

    // Handle visibility change - pause SSE when hidden
    function handleVisibilityChange() {
      if (!isCurrentLifecycle()) return

      if (document.hidden) {
        console.log('[SSE] Page hidden, disconnecting')
        closeEffectEventSource()
        clearEffectReconnectTimeout()
        setIsConnected(false)
      } else {
        console.log('[SSE] Page visible, reconnecting')
        reconnectAttemptsRef.current = 0
        setReconnectAttempts(0)
        connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Initial connection
    connect()

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      closeEffectEventSource()
      clearEffectReconnectTimeout()
    }
  }, [connectionKey, enabled])

  return {
    isConnected,
    error,
    reconnectAttempts
  }
}
