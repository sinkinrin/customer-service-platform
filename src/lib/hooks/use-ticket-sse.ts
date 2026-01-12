'use client'

import { useEffect, useRef, useState } from 'react'
import { TicketUpdate } from './use-ticket-updates'

interface UseTicketSSEOptions {
  enabled?: boolean
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
  const { enabled = true, onUpdate, onConnectionChange, onError } = options

  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  // Use refs to avoid stale closures
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const enabledRef = useRef(enabled)
  const onUpdateRef = useRef(onUpdate)
  const onConnectionChangeRef = useRef(onConnectionChange)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    enabledRef.current = enabled
    onUpdateRef.current = onUpdate
    onConnectionChangeRef.current = onConnectionChange
    onErrorRef.current = onError
  }, [enabled, onUpdate, onConnectionChange, onError])

  useEffect(() => {
    if (!enabled) {
      // Cleanup if disabled
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      setIsConnected(false)
      return
    }

    function connect() {
      // Don't connect if already connected or disabled
      if (eventSourceRef.current || !enabledRef.current) return

      try {
        console.log('[SSE] Connecting...')
        const eventSource = new EventSource('/api/tickets/updates/stream')
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          console.log('[SSE] Connected')
          setIsConnected(true)
          setError(null)
          reconnectAttemptsRef.current = 0
          setReconnectAttempts(0)
          onConnectionChangeRef.current?.(true)
        }

        eventSource.addEventListener('connected', (event) => {
          console.log('[SSE] Server confirmed connection:', event.data)
        })

        eventSource.addEventListener('ticket-update', (event) => {
          try {
            const update = JSON.parse(event.data) as TicketUpdate
            console.log('[SSE] Received update:', update.ticketId, update.event)
            onUpdateRef.current?.(update)
          } catch (parseError) {
            console.error('[SSE] Failed to parse update:', parseError)
          }
        })

        eventSource.onerror = () => {
          console.error('[SSE] Connection error')
          setIsConnected(false)
          onConnectionChangeRef.current?.(false)

          // Close the failed connection
          eventSource.close()
          eventSourceRef.current = null

          // Schedule reconnect if enabled and under max attempts
          if (enabledRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)]
            console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`)
            setError(`Connection lost. Reconnecting...`)

            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++
              setReconnectAttempts(reconnectAttemptsRef.current)
              connect()
            }, delay)
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setError('SSE connection failed. Using polling fallback.')
            onErrorRef.current?.(new Error('Max reconnect attempts exceeded'))
          }
        }
      } catch (err) {
        console.error('[SSE] Failed to create EventSource:', err)
        setError('Failed to establish SSE connection')
        onErrorRef.current?.(err instanceof Error ? err : new Error('Unknown SSE error'))
      }
    }

    // Handle visibility change - pause SSE when hidden
    function handleVisibilityChange() {
      if (document.hidden) {
        console.log('[SSE] Page hidden, disconnecting')
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
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
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [enabled]) // Only depend on enabled

  return {
    isConnected,
    error,
    reconnectAttempts
  }
}
