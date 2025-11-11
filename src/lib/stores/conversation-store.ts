/**
 * Conversation Store
 * 
 * Zustand store for managing conversation state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'file'
  metadata?: {
    file_name?: string
    file_size?: number
    file_url?: string
    mime_type?: string
  }
  created_at: string
  sender?: {
    id: string
    full_name: string
    avatar_url?: string
    role: string
  }
}

export interface Conversation {
  id: string
  business_type_id?: string
  customer_id: string
  staff_id?: string
  status: 'waiting' | 'active' | 'closed'
  message_count: number
  last_message_at?: string
  started_at: string
  ended_at?: string
  created_at: string
  updated_at: string
  business_types?: {
    id: string
    name: string
    description?: string
  }
  customer?: {
    id: string
    full_name: string
    avatar_url?: string
  }
  staff?: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

interface ConversationState {
  // Current conversations list
  conversations: Conversation[]
  
  // Current active conversation
  activeConversation: Conversation | null
  
  // Messages for active conversation
  messages: Message[]
  
  // Loading states
  isLoadingConversations: boolean
  isLoadingMessages: boolean
  isSendingMessage: boolean
  
  // Typing indicator
  isTyping: boolean
  typingUser: string | null
  
  // Actions
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  setActiveConversation: (conversation: Conversation | null) => void
  
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  prependMessages: (messages: Message[]) => void
  
  setLoadingConversations: (loading: boolean) => void
  setLoadingMessages: (loading: boolean) => void
  setSendingMessage: (sending: boolean) => void
  
  setTyping: (isTyping: boolean, user?: string) => void
  
  reset: () => void
}

const initialState = {
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  isTyping: false,
  typingUser: null,
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, _get) => ({
      ...initialState,

      setConversations: (conversations) => set({ conversations }),

      addConversation: (conversation) => set((state) => {
        // Ensure conversations is always an array
        const currentConversations = Array.isArray(state.conversations) ? state.conversations : []
        return {
          conversations: [conversation, ...currentConversations],
        }
      }),
      
      updateConversation: (id, updates) => set((state) => {
        // Ensure conversations is always an array
        const currentConversations = Array.isArray(state.conversations) ? state.conversations : []
        return {
          conversations: currentConversations.map((conv) =>
            conv.id === id ? { ...conv, ...updates } : conv
          ),
          activeConversation:
            state.activeConversation?.id === id
              ? { ...state.activeConversation, ...updates }
              : state.activeConversation,
        }
      }),
      
      setActiveConversation: (conversation) => set({
        activeConversation: conversation,
        messages: [], // Clear messages when switching conversations
      }),
      
      setMessages: (messages) => set({ messages }),
      
      addMessage: (message) => set((state) => {
        // Check if message already exists
        const exists = state.messages.some((m) => m.id === message.id)
        if (exists) return state
        
        return {
          messages: [...state.messages, message],
        }
      }),
      
      prependMessages: (messages) => set((state) => ({
        messages: [...messages, ...state.messages],
      })),
      
      setLoadingConversations: (loading) => set({ isLoadingConversations: loading }),
      setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
      setSendingMessage: (sending) => set({ isSendingMessage: sending }),
      
      setTyping: (isTyping, user) => set({
        isTyping,
        typingUser: user || null,
      }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'conversation-storage',
      // Only persist conversations list, not messages or loading states
      partialize: (state) => ({
        conversations: state.conversations,
      }),
      // Migrate function to fix corrupted state
      migrate: (persistedState: any, version: number) => {
        // Ensure conversations is always an array
        if (persistedState && !Array.isArray(persistedState.conversations)) {
          persistedState.conversations = []
        }
        return persistedState as ConversationState
      },
      version: 1,
    }
  )
)

