/**
 * useConversation Hook
 *
 * Custom hook for conversation management
 *
 * TODO: Replace with real-time updates (Socket.IO, Pusher, or Supabase Realtime)
 * Currently uses polling for updates
 */

import { useCallback } from 'react'
import { useConversationStore, type Conversation, type Message } from '@/lib/stores/conversation-store'
import { useAuthStore } from '@/lib/stores/auth-store'

export function useConversation() {
  const { user } = useAuthStore()
  
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
   * Fetch conversations list
   */
  const fetchConversations = useCallback(async (status?: string) => {
    if (!user) return
    
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
      setConversations(data.data || [])
    } catch (err) {
      const error = err as Error
      console.error('Error fetching conversations:', error)
      throw error
    } finally {
      setLoadingConversations(false)
    }
  }, [user, setConversations, setLoadingConversations])
  
  /**
   * Create a new conversation
   */
  const createConversation = useCallback(async (
    businessTypeId?: string,
    initialMessage?: string
  ) => {
    if (!user) throw new Error('User not authenticated')
    
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
        throw new Error('Failed to create conversation')
      }
      
      const data = await response.json()
      const conversation = data.data as Conversation
      
      addConversation(conversation)
      setActiveConversation(conversation)
      
      return conversation
    } catch (err) {
      const error = err as Error
      console.error('Error creating conversation:', error)
      throw error
    }
  }, [user, addConversation, setActiveConversation])
  
  /**
   * Fetch messages for a conversation
   */
  const fetchMessages = useCallback(async (conversationId: string, offset = 0) => {
    setLoadingMessages(true)
    
    try {
      const params = new URLSearchParams()
      params.append('limit', '50')
      params.append('offset', offset.toString())
      
      const response = await fetch(
        `/api/conversations/${conversationId}/messages?${params.toString()}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }
      
      const data = await response.json()
      const fetchedMessages = data.data.messages || []
      
      if (offset === 0) {
        setMessages(fetchedMessages)
      } else {
        prependMessages(fetchedMessages)
      }
      
      return fetchedMessages
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
    if (!user) throw new Error('User not authenticated')
    
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
        throw new Error('Failed to send message')
      }
      
      const data = await response.json()
      const message = data.data as Message
      
      // Message will be added via Realtime subscription
      // But add it immediately for better UX
      addMessage(message)
      
      return message
    } catch (err) {
      const error = err as Error
      console.error('Error sending message:', error)
      throw error
    } finally {
      setSendingMessage(false)
    }
  }, [user, addMessage, setSendingMessage])
  
  /**
   * Subscribe to real-time updates for a conversation
   *
   * TODO: Replace with real-time subscription (Socket.IO, Pusher, or Supabase Realtime)
   * Currently returns a no-op function
   */
  const subscribeToConversation = useCallback((_conversationId: string) => {
    if (!user) return () => {}

    // TODO: Implement real-time subscription
    // For now, return a no-op cleanup function
    return () => {
      // No cleanup needed for mock implementation
    }
  }, [user])
  
  /**
   * Update conversation status
   */
  const updateConversationStatus = useCallback(async (
    conversationId: string,
    status: 'waiting' | 'active' | 'closed'
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
    
    // Actions
    fetchConversations,
    createConversation,
    fetchMessages,
    sendMessage,
    subscribeToConversation,
    updateConversationStatus,
    setActiveConversation,
    setTyping,
  }
}

