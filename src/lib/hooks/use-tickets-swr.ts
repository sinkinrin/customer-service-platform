/**
 * SWR-based Tickets Hook
 * 
 * Provides client-side caching for ticket data using SWR.
 * Benefits:
 * - Automatic caching and deduplication
 * - Background revalidation (stale-while-revalidate)
 * - Focus revalidation (refetch when tab becomes active)
 * - Error retry with exponential backoff
 * - Optimistic UI updates
 */

import useSWR, { mutate } from 'swr'
import type { ZammadTicket } from '@/lib/stores/ticket-store'

// ============================================================================
// Types
// ============================================================================

export interface TicketsSearchResult {
  tickets: ZammadTicket[]
  total: number
  query: string
  limit: number
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

// ============================================================================
// Fetcher
// ============================================================================

const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  
  if (!response.ok) {
    const error = new Error('Failed to fetch')
    throw error
  }
  
  const json: ApiResponse<T> = await response.json()
  
  if (!json.success) {
    throw new Error(json.error?.message || 'API error')
  }
  
  return json.data
}

// ============================================================================
// SWR Configuration
// ============================================================================

const defaultConfig = {
  // Revalidate on focus (when user returns to tab)
  revalidateOnFocus: true,
  // Revalidate on reconnect (when network comes back)
  revalidateOnReconnect: true,
  // Dedupe requests within 2 seconds
  dedupingInterval: 2000,
  // Keep previous data while revalidating
  keepPreviousData: true,
  // Error retry with exponential backoff
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  // Cache for 30 seconds before considering stale
  // (SWR will still show cached data but revalidate in background)
  refreshInterval: 0, // Don't auto-refresh, only on user action
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for searching tickets with SWR caching
 * 
 * @param query - Search query (e.g., 'state:*')
 * @param limit - Maximum number of tickets to return
 * @param enabled - Whether to fetch (useful for conditional fetching)
 */
export function useTicketsSearch(
  query: string,
  limit: number = 50,
  enabled: boolean = true
) {
  const key = enabled && query 
    ? `/api/tickets/search?query=${encodeURIComponent(query)}&limit=${limit}`
    : null

  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR<TicketsSearchResult>(
    key,
    fetcher,
    {
      ...defaultConfig,
      // For ticket lists, revalidate when window regains focus
      revalidateOnFocus: true,
    }
  )

  return {
    tickets: data?.tickets || [],
    total: data?.total || 0,
    isLoading,
    isValidating, // True when revalidating in background
    error: error?.message || null,
    revalidate, // Manual revalidation function
  }
}

/**
 * Hook for fetching all tickets (admin view)
 */
export function useTicketsList(
  limit: number = 50,
  status?: string,
  enabled: boolean = true
) {
  const params = new URLSearchParams({ limit: limit.toString() })
  if (status) {
    params.append('status', status)
  }

  const key = enabled ? `/api/tickets?${params}` : null

  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR<{
    tickets: ZammadTicket[]
    total: number
  }>(
    key,
    fetcher,
    defaultConfig
  )

  return {
    tickets: data?.tickets || [],
    total: data?.total || 0,
    isLoading,
    isValidating,
    error: error?.message || null,
    revalidate,
  }
}

/**
 * Hook for fetching a single ticket by ID
 */
export function useTicketById(
  ticketId: string | null,
  enabled: boolean = true
) {
  const key = enabled && ticketId ? `/api/tickets/${ticketId}` : null

  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR<{
    ticket: ZammadTicket
  }>(
    key,
    fetcher,
    {
      ...defaultConfig,
      // Single ticket view - revalidate more aggressively
      revalidateOnFocus: true,
    }
  )

  return {
    ticket: data?.ticket || null,
    isLoading,
    isValidating,
    error: error?.message || null,
    revalidate,
  }
}

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Invalidate all ticket-related caches
 * Call this after creating/updating/deleting a ticket
 */
export function invalidateTicketsCache() {
  // Invalidate all keys that start with /api/tickets
  mutate(
    (key) => typeof key === 'string' && key.startsWith('/api/tickets'),
    undefined,
    { revalidate: true }
  )
}

/**
 * Invalidate a specific ticket's cache
 */
export function invalidateTicketCache(ticketId: string) {
  mutate(`/api/tickets/${ticketId}`)
}

/**
 * Prefetch tickets (useful for navigation optimization)
 */
export async function prefetchTickets(query: string, limit: number = 50) {
  const key = `/api/tickets/search?query=${encodeURIComponent(query)}&limit=${limit}`
  await mutate(key, fetcher(key), { revalidate: false })
}
