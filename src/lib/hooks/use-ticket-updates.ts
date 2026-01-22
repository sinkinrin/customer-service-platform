'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

// Polling intervals in milliseconds
const INTERVALS = {
  DEFAULT: 30000,       // 30 seconds - default polling
  FAST: 5000,           // 5 seconds - after receiving updates
  ACTIVE: 15000,        // 15 seconds - when user is active
  FAST_DURATION: 120000 // 2 minutes - how long to stay in fast mode
}

// Types
export interface TicketUpdate {
  id: string
  ticketId: number
  event: 'article_created' | 'status_changed' | 'assigned' | 'created'
  data?: {
    articleId?: number
    senderEmail?: string
    subject?: string
    stateId?: number
    ownerId?: number
    groupId?: number
    customerId?: number
    title?: string
  }
  createdAt: string
}

interface UseTicketUpdatesOptions {
  enabled?: boolean
  onUpdate?: (updates: TicketUpdate[]) => void
}

interface UseTicketUpdatesReturn {
  updates: TicketUpdate[]
  isPolling: boolean
  lastSyncTime: number | null
  error: string | null
}

const LAST_SYNC_KEY = 'ticket-updates-last-sync'

export function useTicketUpdates(options: UseTicketUpdatesOptions = {}): UseTicketUpdatesReturn {
  const { enabled = true, onUpdate } = options
  
  const [updates, setUpdates] = useState<TicketUpdate[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LAST_SYNC_KEY)
      return stored ? parseInt(stored, 10) : null
    }
    return null
  })
  
  // Use ref to avoid poll dependency on lastSyncTime state changes
  const lastSyncTimeRef = useRef<number | null>(lastSyncTime)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentIntervalRef = useRef(INTERVALS.DEFAULT)
  const fastModeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)

  // Poll for updates
  const poll = useCallback(async () => {
    if (!enabled || !isVisibleRef.current) return

    setIsPolling(true)
    setError(null)

    try {
      const since = lastSyncTimeRef.current || Date.now() - 5 * 60 * 1000 // Default to 5 min ago
      const response = await fetch(`/api/tickets/updates?since=${since}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch updates: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.data) {
        const { updates: newUpdates, serverTime } = data.data
        
        // Update last sync time (use ref to avoid triggering useCallback recreation)
        lastSyncTimeRef.current = serverTime
        setLastSyncTime(serverTime)
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_SYNC_KEY, String(serverTime))
        }

        // If we have new updates
        if (newUpdates && newUpdates.length > 0) {
          setUpdates(newUpdates)
          
          // Notify callback
          if (onUpdate) {
            onUpdate(newUpdates)
          }

          // Switch to fast polling mode
          currentIntervalRef.current = INTERVALS.FAST
          
          // Clear previous fast mode timeout
          if (fastModeTimeoutRef.current) {
            clearTimeout(fastModeTimeoutRef.current)
          }
          
          // Return to default after FAST_DURATION
          fastModeTimeoutRef.current = setTimeout(() => {
            currentIntervalRef.current = INTERVALS.DEFAULT
          }, INTERVALS.FAST_DURATION)
        }
      }
    } catch (err) {
      console.error('Polling error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsPolling(false)
    }
  }, [enabled, onUpdate])

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Initial poll
    poll()

    // Set up interval
    intervalRef.current = setInterval(() => {
      poll()
    }, currentIntervalRef.current)
  }, [poll])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
      
      if (document.hidden) {
        stopPolling()
      } else {
        startPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [startPolling, stopPolling])

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (enabled) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
      if (fastModeTimeoutRef.current) {
        clearTimeout(fastModeTimeoutRef.current)
      }
    }
  }, [enabled, startPolling, stopPolling])

  return {
    updates,
    isPolling,
    lastSyncTime,
    error
  }
}
