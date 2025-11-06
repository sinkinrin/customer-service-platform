/**
 * useSSE Hook
 * 
 * React hook for managing SSE connections
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { SSEManager, type SSEConnectionState, type SSEEvent } from '@/lib/sse/sse-manager'

export interface UseSSEOptions {
  url: string
  enabled?: boolean
  onMessage?: (event: SSEEvent) => void
  onError?: (error: Error) => void
}

export interface UseSSEReturn {
  state: SSEConnectionState
  isConnected: boolean
  error: Error | null
  reconnect: () => void
}

export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const { url, enabled = true, onMessage, onError } = options

  const [state, setState] = useState<SSEConnectionState>('disconnected')
  const [error, setError] = useState<Error | null>(null)
  const managerRef = useRef<SSEManager | null>(null)

  // Use refs to store callbacks to avoid recreating SSE connection
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Handle state changes
  const handleStateChange = useCallback((newState: SSEConnectionState) => {
    setState(newState)
    if (newState === 'connected') {
      setError(null)
    }
  }, [])

  // Handle errors
  const handleError = useCallback((err: Error) => {
    setError(err)
    onErrorRef.current?.(err)
  }, [])

  // Wrap onMessage to use ref
  const handleMessage = useCallback((event: SSEEvent) => {
    onMessageRef.current?.(event)
  }, [])

  // Initialize SSE manager
  useEffect(() => {
    if (!enabled) {
      return
    }

    // Check if SSE is supported
    if (!SSEManager.isSupported()) {
      const err = new Error('SSE not supported in this browser')
      setError(err)
      setState('error')
      onErrorRef.current?.(err)
      return
    }

    // Create SSE manager
    managerRef.current = new SSEManager({
      url,
      onMessage: handleMessage,
      onStateChange: handleStateChange,
      onError: handleError,
    })

    // Connect
    managerRef.current.connect()

    // Cleanup on unmount
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect()
        managerRef.current = null
      }
    }
  }, [url, enabled, handleMessage, handleStateChange, handleError])

  // Reconnect function
  const reconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect()
      setTimeout(() => {
        managerRef.current?.connect()
      }, 100)
    }
  }, [])

  return {
    state,
    isConnected: state === 'connected',
    error,
    reconnect,
  }
}

