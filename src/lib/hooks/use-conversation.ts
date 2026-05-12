/**
 * useConversation Hook
 *
 * Simplified hook for AI-only conversation management (SSE removed)
 */

import { useCallback, useEffect } from 'react'
import { useConversationStore, type Conversation, type Message } from '@/lib/stores/conversation-store'
import { useAuth } from '@/lib/hooks/use-auth'
import {
  HISTORY_LIST_PAGE_SIZE,
  HISTORY_MESSAGE_MAX_PER_CONVERSATION,
  HISTORY_MESSAGE_PAGE_SIZE,
} from '@/lib/constants/conversation'

const inflightRequests = new Map<string, Promise<any>>()

export function useConversation() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    conversations,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    setConversations,
    addConversation,
    updateConversation,
    setActiveConversation,
    setMessages,
    addMessage,
    prependMessages,
    setLoadingConversations,
    setLoadingMessages,
    setSendingMessage,
    historyListCache,
    historyMessageCache,
    setHistoryListCache,
    setHistoryMessagesCache,
    touchHistoryListCache,
    touchHistoryMessagesCache,
    removeConversationCache,
    invalidateHistoryListCache,
    updateMessageRatingCache,
    pruneExpiredCache,
    enforceCacheLimits,
    resetForUser,
  } = useConversationStore()

  const userId = user?.id || null
  useEffect(() => {
    if (isAuthLoading) return
    resetForUser(userId)
  }, [isAuthLoading, userId, resetForUser])

  /**
   * Fetch conversations list
   */
  const fetchConversations = useCallback(async (status?: string, limit = 20) => {
    setLoadingConversations(true)

    try {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      params.append('limit', String(limit))

      const response = await fetch(`/api/conversations?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }

      const data = await response.json()
      setConversations(data.data?.conversations || data.data || [])
    } catch (err) {
      const error = err as Error
      console.error('Error fetching conversations:', error)
      throw error
    } finally {
      setLoadingConversations(false)
    }
  }, [setConversations, setLoadingConversations])

  /**
   * Create a new conversation
   */
  const createConversation = useCallback(async (
    businessTypeId?: string,
    initialMessage?: string
  ) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_type_id: businessTypeId,
          initial_message: initialMessage,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create conversation')
      }

      const data = await response.json()
      const conversation = data.data as Conversation

      addConversation(conversation)
      setMessages([]) // Clear messages for new conversation
      setActiveConversation(conversation)
      if (userId) {
        invalidateHistoryListCache(userId)
      }

      return conversation
    } catch (err) {
      const error = err as Error
      console.error('Error creating conversation:', error)
      throw error
    }
  }, [addConversation, setActiveConversation, setMessages, userId, invalidateHistoryListCache])

  /**
   * Fetch messages for a conversation
   */
  const fetchMessages = useCallback(async (conversationId: string, offset = 0, limit = 1000) => {
    setLoadingMessages(true)

    try {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await fetch(
        `/api/conversations/${conversationId}/messages?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      const fetchedMessages = data.data.messages || []

      // API returns messages in descending order (newest first)
      // Reverse them to display in ascending order (oldest first, newest last)
      const sortedMessages = [...fetchedMessages].reverse()

      if (offset === 0) {
        setMessages(sortedMessages)
      } else {
        // For pagination, prepend older messages
        prependMessages(sortedMessages)
      }

      return sortedMessages
    } catch (err) {
      const error = err as Error
      console.error('Error fetching messages:', error)
      throw error
    } finally {
      setLoadingMessages(false)
    }
  }, [setMessages, prependMessages, setLoadingMessages])

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    metadata?: Record<string, unknown>
  ) => {
    setSendingMessage(true)

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          message_type: messageType,
          metadata,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send message')
      }

      const data = await response.json()
      const message = data.data as Message

      addMessage(message)
      if (userId) {
        const key = `${userId}:${conversationId}`
        const cached = useConversationStore.getState().historyMessageCache[key]
        if (cached) {
          setHistoryMessagesCache(userId, conversationId, [...cached.items, message], cached.cursor)
          enforceCacheLimits()
        }
      }

      return message
    } catch (err) {
      const error = err as Error
      console.error('Error sending message:', error)
      throw error
    } finally {
      setSendingMessage(false)
    }
  }, [addMessage, setSendingMessage, userId, setHistoryMessagesCache, enforceCacheLimits])

  const fetchHistoryConversations = useCallback(async (offset = 0, limit = HISTORY_LIST_PAGE_SIZE) => {
    if (!userId) throw new Error('Unauthorized')
    pruneExpiredCache()
    const dedupeKey = `${userId}:history-list:${offset}:${limit}`
    if (inflightRequests.has(dedupeKey)) {
      return inflightRequests.get(dedupeKey)!
    }
    const request = (async () => {
      const response = await fetch(`/api/conversations?limit=${limit}&offset=${offset}`)
      if (!response.ok) throw new Error('Failed to fetch conversation history')
      const data = await response.json()
      const items = (data.data?.conversations || data.data || []) as Conversation[]
      const cachedEntry = useConversationStore.getState().historyListCache[userId]
      const cached = cachedEntry?.items || []
      if (cachedEntry?.items?.length) {
        touchHistoryListCache(userId)
      }
      const merged = offset === 0 ? [...items, ...cached] : [...cached, ...items]
      const unique = Array.from(new Map(merged.map((item) => [item.id, item])).values())
      const incomingCursor = items.length === limit ? offset + limit : null
      const nextCursor = incomingCursor === null
        ? (cachedEntry?.cursor ?? null)
        : Math.max(cachedEntry?.cursor ?? 0, incomingCursor)
      setHistoryListCache(userId, unique, nextCursor)
      enforceCacheLimits()
      return {
        items: unique,
        pageItems: items,
        hasMore: items.length === limit,
        nextOffset: nextCursor ?? offset + limit,
      }
    })()
    inflightRequests.set(dedupeKey, request)
    try {
      return await request
    } finally {
      inflightRequests.delete(dedupeKey)
    }
  }, [userId, setHistoryListCache, pruneExpiredCache, enforceCacheLimits, touchHistoryListCache])

  const fetchHistoryMessages = useCallback(async (conversationId: string, offset = 0, limit = HISTORY_MESSAGE_PAGE_SIZE) => {
    if (!userId) throw new Error('Unauthorized')
    pruneExpiredCache()
    const dedupeKey = `${userId}:${conversationId}:${offset}:${limit}`
    if (inflightRequests.has(dedupeKey)) {
      return inflightRequests.get(dedupeKey)!
    }
    const request = (async () => {
      const response = await fetch(`/api/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`)
      if (!response.ok) throw new Error('Failed to fetch conversation messages')
      const data = await response.json()
      const fetchedMessages = (data.data?.messages || []) as Message[]
      const sortedMessages = [...fetchedMessages].reverse()
      const key = `${userId}:${conversationId}`
      const cachedEntry = useConversationStore.getState().historyMessageCache[key]
      const cached = cachedEntry?.items || []
      if (cachedEntry?.items?.length) {
        touchHistoryMessagesCache(userId, conversationId)
      }
      const merged = offset === 0 ? [...cached, ...sortedMessages] : [...sortedMessages, ...cached]
      const unique = Array.from(new Map(merged.map((item) => [item.id, item])).values())
      const cacheItems = unique.slice(-HISTORY_MESSAGE_MAX_PER_CONVERSATION)
      const incomingCursor = fetchedMessages.length === limit ? offset + limit : null
      const nextCursor = incomingCursor === null
        ? (cachedEntry?.cursor ?? null)
        : Math.max(cachedEntry?.cursor ?? 0, incomingCursor)
      setHistoryMessagesCache(userId, conversationId, cacheItems, nextCursor)
      enforceCacheLimits()
      return {
        items: unique,
        pageItems: sortedMessages,
        hasMore: fetchedMessages.length === limit,
        nextOffset: nextCursor ?? offset + limit,
      }
    })()
    inflightRequests.set(dedupeKey, request)
    try {
      return await request
    } finally {
      inflightRequests.delete(dedupeKey)
    }
  }, [userId, setHistoryMessagesCache, pruneExpiredCache, enforceCacheLimits, touchHistoryMessagesCache])

  const closeConversation = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    if (!response.ok) {
      throw new Error('Failed to close conversation')
    }
    if (userId) {
      invalidateHistoryListCache(userId)
      removeConversationCache(userId, conversationId)
    }
  }, [invalidateHistoryListCache, removeConversationCache, userId])

  const deleteConversation = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error('Failed to delete conversation')
    }
    if (userId) {
      invalidateHistoryListCache(userId)
      removeConversationCache(userId, conversationId)
    }
  }, [invalidateHistoryListCache, removeConversationCache, userId])

  const applyRatingToCache = useCallback((
    conversationId: string,
    messageId: string,
    rating: 'positive' | 'negative' | null,
    feedback?: string | null
  ) => {
    if (!userId) return
    updateMessageRatingCache(userId, conversationId, messageId, rating, feedback)
  }, [updateMessageRatingCache, userId])

  const appendHistoryMessageToCache = useCallback((conversationId: string, message: Message) => {
    if (!userId) return
    const key = `${userId}:${conversationId}`
    const cached = useConversationStore.getState().historyMessageCache[key]
    const nextItems = cached ? [...cached.items, message] : [message]
    setHistoryMessagesCache(userId, conversationId, nextItems, cached?.cursor ?? null)
    enforceCacheLimits()
  }, [enforceCacheLimits, setHistoryMessagesCache, userId])

  /**
   * Fetch a single conversation by ID
   */
  const fetchConversationById = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch conversation')
      }

      const data = await response.json()
      const conversation = data.data as Conversation

      setActiveConversation(conversation)
      updateConversation(conversationId, conversation)

      return conversation
    } catch (err) {
      const error = err as Error
      console.error('Error fetching conversation:', error)
      throw error
    }
  }, [setActiveConversation, updateConversation])

  return {
    // State
    conversations,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,

    // Actions
    fetchConversations,
    createConversation,
    fetchConversationById,
    fetchMessages,
    fetchHistoryConversations,
    fetchHistoryMessages,
    sendMessage,
    closeConversation,
    deleteConversation,
    applyRatingToCache,
    appendHistoryMessageToCache,
    setActiveConversation,
    addMessage,
    historyListCache,
    historyMessageCache,
    userId,
  }
}
