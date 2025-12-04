/**
 * useConversation Hook
 *
 * Custom hook for conversation management with SSE real-time updates
 */

import { useCallback } from 'react'
import { useConversationStore, type Conversation, type Message } from '@/lib/stores/conversation-store'
import { useSSE } from '@/lib/hooks/use-sse'
import { useAuth } from '@/lib/hooks/use-auth'

export function useConversation() {
  const { user } = useAuth()

  const {
    conversations,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    isTyping,
    typingUser,
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
    setTyping,
  } = useConversationStore()

  /**
   * Set up SSE connection for real-time updates
   */
  const { isConnected: sseConnected, error: sseError } = useSSE({
    url: '/api/sse/conversations',
    enabled: !!user,
    onMessage: (event) => {
      console.log('[SSE] Received event:', event.type, event)

      switch (event.type) {
        case 'connected':
          console.log('[SSE] Connected to conversations stream')
          break

        case 'new_message':
          // Add new message to store if it's for the active conversation
          if (event.conversationId === activeConversation?.id) {
            console.log('[SSE] Adding new message to active conversation')
            addMessage(event.data)
          }
          // Update conversation list (last_message_at)
          if (event.data.conversation_id) {
            updateConversation(event.data.conversation_id, {
              last_message_at: event.data.created_at,
            })
          }
          break

        case 'conversation_updated':
          console.log('[SSE] Conversation updated:', event.conversationId)
          if (event.conversationId) {
            updateConversation(event.conversationId, event.data)
          }
          break

        case 'conversation_created':
          console.log('[SSE] New conversation created:', event.conversationId)
          addConversation(event.data)
          break

        case 'typing':
          console.log('[SSE] User typing:', event.data.userId)
          setTyping(true, event.data.userName)
          // Auto-clear typing indicator after 3 seconds
          setTimeout(() => setTyping(false), 3000)
          break

        case 'timeout':
          console.log('[SSE] Connection timeout, will reconnect...')
          break

        default:
          console.log('[SSE] Unknown event type:', event.type)
      }
    },
    onError: (error) => {
      console.error('[SSE] Connection error:', error)
    },
  })

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
  }, [addConversation, setActiveConversation])

  /**
   * Fetch messages for a conversation
   * @param conversationId - Conversation ID
   * @param offset - Offset for pagination (default: 0)
   * @param limit - Number of messages to fetch (default: 1000 to load all messages)
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

      // Message will be added via SSE event, but add it immediately for better UX
      // The SSE event will be a no-op if message already exists (due to duplicate check in store)
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
   * Subscribe to real-time updates for a conversation
   * SSE connection is now managed globally via useSSE hook
   */
  const subscribeToConversation = useCallback((conversationId: string) => {
    console.log('[Conversation] Subscribed to conversation:', conversationId, 'via SSE')

    // Return cleanup function
    return () => {
      console.log('[Conversation] Unsubscribed from conversation:', conversationId)
      // Cleanup is handled by useSSE hook
    }
  }, [])

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

  /**
   * Update conversation status
   */
  const updateConversationStatus = useCallback(async (
    conversationId: string,
    status: 'active' | 'closed'
  ) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Failed to update conversation')
      }

      const data = await response.json()
      updateConversation(conversationId, data.data)
    } catch (err) {
      const error = err as Error
      console.error('Error updating conversation:', error)
      throw error
    }
  }, [updateConversation])

  return {
    // State
    conversations,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    isTyping,
    typingUser,
    sseConnected,
    sseError,

    // Actions
    fetchConversations,
    createConversation,
    fetchConversationById,
    fetchMessages,
    sendMessage,
    subscribeToConversation,
    updateConversationStatus,
    setActiveConversation,
    setTyping,
    addMessage,  // Expose addMessage for direct message insertion (e.g., from SSE events)
  }
}
