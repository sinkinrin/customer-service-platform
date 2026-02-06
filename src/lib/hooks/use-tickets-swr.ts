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
  page: number
}

export interface TicketSearchFilters {
  status?: string
  priority?: number
  groupId?: number
  queryMode?: 'auto' | 'keyword' | 'dsl'
  sort?: string
  order?: 'asc' | 'desc'
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
 * @param page - Page number (1-based)
 * @param enabled - Whether to fetch (useful for conditional fetching)
 * @param filters - Optional server-side filters (status, priority, group, sorting)
 */
export function useTicketsSearch(
  query: string,
  limit: number = 50,
  page: number = 1,
  enabled: boolean = true,
  filters?: TicketSearchFilters
) {
  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
    page: page.toString(),
  })
  if (filters?.status) {
    params.append('status', filters.status)
  }
  if (filters?.priority) {
    params.append('priority', filters.priority.toString())
  }
  if (filters?.groupId) {
    params.append('group_id', filters.groupId.toString())
  }
  if (filters?.queryMode) {
    params.append('queryMode', filters.queryMode)
  }
  if (filters?.sort) {
    params.append('sort', filters.sort)
  }
  if (filters?.order) {
    params.append('order', filters.order)
  }

  const key = enabled ? `/api/tickets/search?${params}` : null

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
  page: number = 1,
  status?: string,
  priority?: number,
  groupId?: number,
  enabled: boolean = true
) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page: page.toString(),
  })
  if (status) {
    params.append('status', status)
  }
  if (priority) {
    params.append('priority', priority.toString())
  }
  if (groupId) {
    params.append('group_id', groupId.toString())
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
export async function prefetchTickets(
  query: string,
  limit: number = 50,
  page: number = 1,
  filters?: TicketSearchFilters
) {
  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
    page: page.toString(),
  })
  if (filters?.status) {
    params.append('status', filters.status)
  }
  if (filters?.priority) {
    params.append('priority', filters.priority.toString())
  }
  if (filters?.groupId) {
    params.append('group_id', filters.groupId.toString())
  }
  if (filters?.queryMode) {
    params.append('queryMode', filters.queryMode)
  }
  if (filters?.sort) {
    params.append('sort', filters.sort)
  }
  if (filters?.order) {
    params.append('order', filters.order)
  }

  const key = `/api/tickets/search?${params}`
  await mutate(key, fetcher(key), { revalidate: false })
}
