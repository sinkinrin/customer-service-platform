/**
 * useConversation Hook
 *
 * Simplified hook for AI-only conversation management (SSE removed)
 */

import { useCallback } from 'react'
import { useConversationStore, type Conversation, type Message } from '@/lib/stores/conversation-store'

export function useConversation() {
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
  } = useConversationStore()

  /**
   * Fetch conversations list
   */
  const fetchConversations = useCallback(async (status?: string) => {
    setLoadingConversations(true)

    try {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      params.append('limit', '20')

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

      return conversation
    } catch (err) {
      const error = err as Error
      console.error('Error creating conversation:', error)
      throw error
    }
  }, [addConversation, setActiveConversation, setMessages])

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

      return message
    } catch (err) {
      const error = err as Error
      console.error('Error sending message:', error)
      throw error
    } finally {
      setSendingMessage(false)
    }
  }, [addMessage, setSendingMessage])

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
    sendMessage,
    setActiveConversation,
    addMessage,
  }
}
