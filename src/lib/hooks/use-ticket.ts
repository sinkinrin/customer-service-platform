import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { ZammadTicket } from '@/lib/stores/ticket-store'

export interface TicketArticleAttachment {
  id: number
  filename: string
  size: string
  preferences: {
    'Content-Type'?: string
    'Mime-Type'?: string
    'content-alternative'?: boolean
  }
}

export interface TicketArticle {
  id: number
  ticket_id: number
  subject: string | null
  body: string
  content_type: 'text/html' | 'text/plain' | string
  type: 'email' | 'note' | 'web' | 'phone' | string
  sender: 'Agent' | 'Customer' | 'System' | string
  internal: boolean
  from: string
  to?: string | null
  cc?: string | null
  created_at: string
  created_by: string
  updated_by?: string
  attachments: TicketArticleAttachment[]
}

export interface SearchTicketsResult {
  tickets: ZammadTicket[]
  total: number
}

export function useTicket() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = useCallback(async (
    limit: number = 50,
    status?: string
  ): Promise<SearchTicketsResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ limit: limit.toString() })
      if (status) {
        params.append('status', status)
      }

      const response = await fetch(`/api/tickets?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }

      const data = await response.json()
      return {
        tickets: data.data.tickets || [],
        total: data.data.total || 0,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tickets'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const searchTickets = useCallback(async (
    query: string,
    limit: number = 10
  ): Promise<SearchTicketsResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/tickets/search?query=${encodeURIComponent(query)}&limit=${limit}&queryMode=dsl`
      )

      if (!response.ok) {
        throw new Error('Failed to search tickets')
      }

      const data = await response.json()
      return {
        tickets: data.data.tickets || [],
        total: data.data.total || 0,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search tickets'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchTicketByConversationId = useCallback(async (
    conversationId: string
  ): Promise<ZammadTicket | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tickets/${conversationId}`)

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to fetch ticket')
      }

      const data = await response.json()
      return data.data.ticket
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch ticket'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchTicketById = useCallback(async (
    ticketId: string
  ): Promise<ZammadTicket | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tickets/${ticketId}`)

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to fetch ticket')
      }

      const data = await response.json()
      return data.data.ticket
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch ticket'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateTicket = useCallback(async (
    conversationId: string,
    updates: {
      title?: string
      group?: string
      state?: string
      priority?: string
      owner_id?: number
    }
  ): Promise<ZammadTicket | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tickets/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update ticket')
      }

      const data = await response.json()
      toast.success('Ticket updated successfully')
      return data.data.ticket
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update ticket'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addArticle = useCallback(async (
    conversationId: string,
    messageId: string,
    article: {
      subject: string
      body: string
      internal?: boolean
      attachments?: Array<{filename: string; data: string; 'mime-type': string}>
      // Note: attachment_ids is deprecated - Zammad retrieves attachments from UploadCache by form_id
      // @deprecated Use form_id instead - Zammad's CreatesTicketArticles processes form_id to get cached files
      attachment_ids?: number[]
      form_id?: string  // Form ID from upload_caches - Zammad automatically retrieves attached files
      type?: 'note' | 'email' | 'phone' | 'web'  // 'email' will send email to customer
    }
  ): Promise<TicketArticle | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tickets/${conversationId}/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          ...article,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add article')
      }

      const data = await response.json()
      toast.success('Article added successfully')
      return data.data.article
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add article'
      setError(message)
      toast.error(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchArticles = useCallback(async (
    conversationId: string
  ): Promise<TicketArticle[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tickets/${conversationId}/articles`)

      if (!response.ok) {
        throw new Error('Failed to fetch articles')
      }

      const data = await response.json()
      return data.data.articles || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch articles'
      setError(message)
      toast.error(message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    error,
    fetchTickets,
    searchTickets,
    fetchTicketByConversationId,
    fetchTicketById,
    updateTicket,
    addArticle,
    fetchArticles,
  }
}

