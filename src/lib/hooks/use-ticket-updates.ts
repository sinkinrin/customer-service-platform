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
  userId?: string | null
  identityKey?: string | null
}

interface UseTicketUpdatesReturn {
  updates: TicketUpdate[]
  isPolling: boolean
  lastSyncTime: number | null
  error: string | null
}

const LAST_SYNC_KEY_PREFIX = 'ticket-updates-last-sync'
const PROCESSED_UPDATES_KEY_PREFIX = 'ticket-updates-processed'
const PROCESSED_UPDATE_RETENTION_MS = 8 * 24 * 60 * 60 * 1000
const MAX_PROCESSED_UPDATE_IDS = 1000

interface ProcessedTicketUpdate {
  id: string
  processedAt: number
}

const inMemoryProcessedUpdates = new Map<string, Map<string, number>>()

export function getLastSyncStorageKey(userId?: string | null): string {
  return `${LAST_SYNC_KEY_PREFIX}:${userId || 'anonymous'}`
}

export function getProcessedUpdatesStorageKey(userId?: string | null): string {
  return `${PROCESSED_UPDATES_KEY_PREFIX}:${userId || 'anonymous'}`
}

function readLastSyncTime(storageKey: string): number | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return null

    const parsed = parseInt(stored, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function persistLastSyncTime(storageKey: string, serverTime: number) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(storageKey, String(serverTime))
  } catch {
    // The in-memory cursor and state remain authoritative for this page when
    // storage is unavailable (for example, privacy mode SecurityError).
  }
}

function trimProcessedUpdates(updates: Map<string, number>, now: number) {
  const cutoff = now - PROCESSED_UPDATE_RETENTION_MS

  for (const [id, processedAt] of updates) {
    if (processedAt < cutoff) {
      updates.delete(id)
    }
  }

  if (updates.size <= MAX_PROCESSED_UPDATE_IDS) return

  const oldestFirst = [...updates.entries()].sort((a, b) => a[1] - b[1])
  for (const [id] of oldestFirst.slice(0, updates.size - MAX_PROCESSED_UPDATE_IDS)) {
    updates.delete(id)
  }
}

function loadProcessedUpdates(storageKey: string, now: number): Map<string, number> {
  const updates = inMemoryProcessedUpdates.get(storageKey) ?? new Map<string, number>()

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(storageKey)
      const parsed = stored ? JSON.parse(stored) : []

      if (Array.isArray(parsed)) {
        for (const entry of parsed as ProcessedTicketUpdate[]) {
          if (
            entry &&
            typeof entry.id === 'string' &&
            typeof entry.processedAt === 'number' &&
            Number.isFinite(entry.processedAt)
          ) {
            const currentTimestamp = updates.get(entry.id) ?? 0
            updates.set(entry.id, Math.max(currentTimestamp, entry.processedAt))
          }
        }
      }
    } catch {
      // Keep the in-memory registry when storage is unavailable or malformed.
    }
  }

  trimProcessedUpdates(updates, now)
  inMemoryProcessedUpdates.set(storageKey, updates)
  return updates
}

function persistProcessedUpdates(storageKey: string, updates: Map<string, number>) {
  if (typeof window === 'undefined') return

  try {
    const serialized: ProcessedTicketUpdate[] = [...updates.entries()].map(
      ([id, processedAt]) => ({ id, processedAt })
    )
    localStorage.setItem(storageKey, JSON.stringify(serialized))
  } catch {
    // In-memory deduplication still protects the active page if storage fails.
  }
}

function claimTicketUpdateFromRegistry(updateId: string, userId?: string | null): boolean {
  const now = Date.now()
  const storageKey = getProcessedUpdatesStorageKey(userId)
  const updates = loadProcessedUpdates(storageKey, now)

  if (updates.has(updateId)) {
    return false
  }

  updates.set(updateId, now)
  trimProcessedUpdates(updates, now)
  persistProcessedUpdates(storageKey, updates)
  return true
}

/**
 * Claims an update for this browser and user. Web Locks serializes the
 * localStorage read-modify-write across tabs; older browsers retain bounded
 * localStorage and in-memory deduplication as a best-effort fallback.
 */
export async function claimTicketUpdateForProcessing(
  updateId: string,
  userId?: string | null,
  isEligible: () => boolean = () => true
): Promise<boolean> {
  const claimIfEligible = () => {
    if (!isEligible()) return false
    return claimTicketUpdateFromRegistry(updateId, userId)
  }

  if (!updateId) return isEligible()

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    // Every update for a user mutates the same registry value. Lock the
    // registry, not an individual ID, so concurrent claims cannot overwrite
    // each other's localStorage read-modify-write cycle across tabs.
    const lockName = getProcessedUpdatesStorageKey(userId)

    try {
      return await navigator.locks.request(lockName, claimIfEligible)
    } catch {
      // Fall through when Web Locks is unavailable at runtime.
    }
  }

  return claimIfEligible()
}

export function useTicketUpdates(options: UseTicketUpdatesOptions = {}): UseTicketUpdatesReturn {
  const { enabled = true, onUpdate, userId, identityKey } = options
  const storageKey = getLastSyncStorageKey(userId)
  const effectiveIdentityKey = identityKey ?? userId ?? 'anonymous'
  const lifecycleKey = `${enabled ? 'enabled' : 'disabled'}:${effectiveIdentityKey}`
  
  const [updates, setUpdates] = useState<TicketUpdate[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() =>
    readLastSyncTime(storageKey)
  )
  
  // Use ref to avoid poll dependency on lastSyncTime state changes
  const lastSyncTimeRef = useRef<number | null>(lastSyncTime)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentIntervalRef = useRef(INTERVALS.DEFAULT)
  const fastModeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const lifecycleKeyRef = useRef(lifecycleKey)
  const onUpdateRef = useRef(onUpdate)

  // Render-time refs close the small gap before passive effect cleanup runs.
  lifecycleKeyRef.current = lifecycleKey
  onUpdateRef.current = onUpdate

  const abortCurrentRequest = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  // Poll for updates
  const poll = useCallback(async () => {
    if (!enabled || !isVisibleRef.current) return

    // Interval ticks must not starve a slow but healthy request by repeatedly
    // aborting it. Lifecycle cleanup still aborts on identity changes,
    // disable, unmount, or page hide.
    if (abortControllerRef.current) return

    const controller = new AbortController()
    const requestGeneration = generationRef.current
    const requestLifecycleKey = lifecycleKey
    abortControllerRef.current = controller

    const isCurrentRequest = () =>
      !controller.signal.aborted &&
      generationRef.current === requestGeneration &&
      lifecycleKeyRef.current === requestLifecycleKey

    setIsPolling(true)
    setError(null)

    try {
      const since = lastSyncTimeRef.current || Date.now() - 5 * 60 * 1000 // Default to 5 min ago
      const response = await fetch(`/api/tickets/updates?since=${since}`, {
        signal: controller.signal,
      })

      if (!isCurrentRequest()) return
      
      if (!response.ok) {
        throw new Error(`Failed to fetch updates: ${response.status}`)
      }

      const data = await response.json()

      if (!isCurrentRequest()) return
      
      if (data.success && data.data) {
        const { updates: newUpdates, serverTime } = data.data
        
        // Update last sync time (use ref to avoid triggering useCallback recreation)
        lastSyncTimeRef.current = serverTime
        setLastSyncTime(serverTime)
        persistLastSyncTime(storageKey, serverTime)

        // If we have new updates
        if (newUpdates && newUpdates.length > 0) {
          setUpdates(newUpdates)
          
          // Notify callback
          onUpdateRef.current?.(newUpdates)

          // Switch to fast polling mode
          currentIntervalRef.current = INTERVALS.FAST
          
          // Clear previous fast mode timeout
          if (fastModeTimeoutRef.current) {
            clearTimeout(fastModeTimeoutRef.current)
          }
          
          // Return to default after FAST_DURATION
          fastModeTimeoutRef.current = setTimeout(() => {
            if (isCurrentRequest()) {
              currentIntervalRef.current = INTERVALS.DEFAULT
            }
          }, INTERVALS.FAST_DURATION)
        }
      }
    } catch (err) {
      if (controller.signal.aborted || !isCurrentRequest()) return
      console.error('Polling error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      if (isCurrentRequest()) {
        setIsPolling(false)
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }, [enabled, lifecycleKey, storageKey])

  useEffect(() => {
    generationRef.current += 1
    abortCurrentRequest()
    currentIntervalRef.current = INTERVALS.DEFAULT
    if (fastModeTimeoutRef.current) {
      clearTimeout(fastModeTimeoutRef.current)
      fastModeTimeoutRef.current = null
    }

    lastSyncTimeRef.current = readLastSyncTime(storageKey)
    setLastSyncTime(lastSyncTimeRef.current)
    setUpdates([])
    setError(null)
    setIsPolling(false)

    return () => {
      generationRef.current += 1
      abortCurrentRequest()
      if (fastModeTimeoutRef.current) {
        clearTimeout(fastModeTimeoutRef.current)
        fastModeTimeoutRef.current = null
      }
    }
  }, [abortCurrentRequest, lifecycleKey, storageKey])

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Initial poll
    void poll()

    // Set up interval
    intervalRef.current = setInterval(() => {
      void poll()
    }, currentIntervalRef.current)
  }, [poll])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    abortCurrentRequest()
  }, [abortCurrentRequest])

  // Handle visibility change
  useEffect(() => {
    isVisibleRef.current = !document.hidden

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
      
      if (document.hidden) {
        stopPolling()
        setIsPolling(false)
      } else if (enabled) {
        startPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, startPolling, stopPolling])

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (enabled && isVisibleRef.current) {
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
