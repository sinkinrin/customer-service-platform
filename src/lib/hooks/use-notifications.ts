"use client"

import useSWR from 'swr'

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  read: boolean
  readAt: string | null
  createdAt: string
  expiresAt: string | null
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  const json = (await response.json()) as ApiResponse<T>
  if (!json.success) throw new Error(json.error?.message || 'API error')
  return json.data
}

async function mutatingRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  const json = (await response.json()) as ApiResponse<T>
  if (!json.success) throw new Error(json.error?.message || 'API error')
  return json.data
}

export function useNotifications(options?: {
  limit?: number
  offset?: number
  pollIntervalMs?: number
  enabled?: boolean
}) {
  const limit = options?.limit ?? 20
  const offset = options?.offset ?? 0
  const pollIntervalMs = options?.pollIntervalMs ?? 15000
  const enabled = options?.enabled ?? true

  const key = enabled ? `/api/notifications?limit=${limit}&offset=${offset}` : null

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<{
    notifications: NotificationItem[]
    unreadCount: number
    total: number
  }>(key, fetcher, {
    refreshInterval: pollIntervalMs,
    revalidateOnFocus: true,
  })

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  const markAsRead = async (id: string) => {
    try {
      await mutatingRequest<{ updated: boolean }>(`/api/notifications/${id}/read`, { method: 'PUT' })
    } catch (error) {
      // Ignore 404 errors - notification may already be deleted
      if (error instanceof Error && error.message.includes('404')) {
        // Notification already deleted or marked as read, just refresh the list
      } else {
        throw error
      }
    }
    await mutate()
  }

  const markAllAsRead = async () => {
    await mutatingRequest<{ updated: number }>(`/api/notifications/read-all`, { method: 'PUT' })
    await mutate()
  }

  const deleteNotification = async (id: string) => {
    try {
      await mutatingRequest<{ deleted: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' })
    } catch (error) {
      // Ignore 404 errors - notification may already be deleted
      if (error instanceof Error && error.message.includes('404')) {
        // Notification already deleted, just refresh the list
      } else {
        throw error
      }
    }
    await mutate()
  }

  const refresh = async () => {
    await mutate()
  }

  const markTicketNotificationsAsRead = async (ticketId: number) => {
    const target = notifications.filter((n) => {
      const dataTicketId = (n.data as any)?.ticketId
      return !n.read && typeof dataTicketId === 'number' && dataTicketId === ticketId
    })

    for (const item of target) {
      await markAsRead(item.id)
    }
  }

  return {
    notifications,
    unreadCount,
    total: data?.total ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    markTicketNotificationsAsRead,
  }
}

