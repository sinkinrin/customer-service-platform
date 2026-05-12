/**
 * Conversation Store
 *
 * Zustand store for managing AI conversation state (simplified - human mode removed)
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  HISTORY_CACHE_MAX_BYTES,
  HISTORY_CACHE_TTL_MS,
  HISTORY_LIST_MAX,
  HISTORY_MESSAGE_MAX_CONVERSATIONS,
  HISTORY_MESSAGE_MAX_PER_CONVERSATION,
} from '@/lib/constants/conversation'

type HistoryListCacheEntry = { items: Conversation[]; updatedAt: number; cursor: number | null; lastAccessAt: number }
type HistoryMessageCacheEntry = { items: Message[]; updatedAt: number; cursor: number | null; lastAccessAt: number }

function getLastAccessAt(value: { lastAccessAt?: number; updatedAt: number }) {
  return value.lastAccessAt ?? value.updatedAt
}

function measureBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size
}

export function pruneHistoryCachesForLimits(
  historyListCache: Record<string, HistoryListCacheEntry>,
  historyMessageCache: Record<string, HistoryMessageCacheEntry>,
  context?: { currentUserId: string | null; conversations: Conversation[] }
) {
  const listTrimmed = Object.fromEntries(
    Object.entries(historyListCache).map(([key, value]) => [key, { ...value, items: value.items.slice(0, HISTORY_LIST_MAX) }])
  )
  const msgEntries = Object.entries(historyMessageCache)
    .sort((a, b) => getLastAccessAt(b[1]) - getLastAccessAt(a[1]))
    .slice(0, HISTORY_MESSAGE_MAX_CONVERSATIONS)
  const msgTrimmed = Object.fromEntries(msgEntries)

  const base = {
    currentUserId: context?.currentUserId ?? null,
    conversations: context?.conversations ?? [],
  }
  let next = { historyListCache: listTrimmed, historyMessageCache: msgTrimmed }
  if (measureBytes({ ...base, ...next }) <= HISTORY_CACHE_MAX_BYTES) {
    return next
  }

  const mutableMsg = [...msgEntries]
  while (mutableMsg.length > 0) {
    mutableMsg.pop()
    next = { ...next, historyMessageCache: Object.fromEntries(mutableMsg) }
    if (measureBytes({ ...base, ...next }) <= HISTORY_CACHE_MAX_BYTES) {
      return next
    }
  }

  const mutableList = Object.entries(listTrimmed).sort((a, b) => getLastAccessAt(b[1]) - getLastAccessAt(a[1]))
  while (mutableList.length > 0) {
    mutableList.pop()
    next = { historyMessageCache: {}, historyListCache: Object.fromEntries(mutableList) }
    if (measureBytes({ ...base, ...next }) <= HISTORY_CACHE_MAX_BYTES) {
      return next
    }
  }

  return { historyMessageCache: {}, historyListCache: {} }
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  metadata?: {
    file_name?: string
    file_size?: number
    file_url?: string
    mime_type?: string
    type?: string
    aiMode?: boolean
    role?: string
    [key: string]: any
  }
  created_at: string
  sender?: {
    id: string
    full_name: string
    avatar_url?: string
    role: string
  }
  rating?: {
    id: string
    rating: 'positive' | 'negative'
    feedback?: string | null
  } | null
}

export interface Conversation {
  id: string
  business_type_id?: string
  customer_id: string
  customer_email?: string
  status: 'active' | 'closed'
  mode: 'ai'
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
    email?: string
    avatar_url?: string
  }
}

interface ConversationState {
  currentUserId: string | null
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
  historyListCache: Record<string, HistoryListCacheEntry>
  historyMessageCache: Record<string, HistoryMessageCacheEntry>

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
  setHistoryListCache: (userId: string, items: Conversation[], cursor: number | null) => void
  setHistoryMessagesCache: (userId: string, conversationId: string, items: Message[], cursor: number | null) => void
  touchHistoryListCache: (userId: string) => void
  touchHistoryMessagesCache: (userId: string, conversationId: string) => void
  removeConversationCache: (userId: string, conversationId: string) => void
  invalidateHistoryListCache: (userId: string) => void
  updateMessageRatingCache: (userId: string, conversationId: string, messageId: string, rating: 'positive' | 'negative' | null, feedback?: string | null) => void
  pruneExpiredCache: () => void
  enforceCacheLimits: () => void
  clearHistoryCacheForUser: (userId: string) => void
  resetForUser: (userId: string | null) => void

  reset: () => void
}

const initialState = {
  currentUserId: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  historyListCache: {},
  historyMessageCache: {},
}

const noopStorage = {
  getItem: (_name: string) => null,
  setItem: (_name: string, _value: string) => undefined,
  removeItem: (_name: string) => undefined,
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createConversationStorageAdapter(storageImpl?: StorageLike) {
  const storage = storageImpl ?? (typeof localStorage === 'undefined' ? noopStorage : localStorage)
  return {
    getItem: (name: string) => storage.getItem(name),
    setItem: (name: string, value: string) => {
      try {
        storage.setItem(name, value)
      } catch {
        const fallback = buildFallbackStateForQuota(value)
        try {
          storage.setItem(name, fallback)
        } catch {
          // Ignore quota failures to keep chat send/receive path functional.
        }
      }
    },
    removeItem: (name: string) => storage.removeItem(name),
  }
}

export function buildFallbackStateForQuota(serializedValue: string) {
  try {
    const parsed = JSON.parse(serializedValue)
    const state = parsed?.state
    if (!state) return serializedValue
    const pruned = pruneHistoryCachesForLimits(
      state.historyListCache || {},
      state.historyMessageCache || {},
      { currentUserId: state.currentUserId ?? null, conversations: state.conversations ?? [] }
    )
    return JSON.stringify({
      ...parsed,
      state: {
        ...state,
        ...pruned,
      },
    })
  } catch {
    return serializedValue
  }
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, _get) => ({
      ...initialState,

      setHistoryListCache: (userId, items, cursor) => set((state) => {
        const nextItems = items.slice(0, HISTORY_LIST_MAX)
        const now = Date.now()
        return {
          historyListCache: {
            ...state.historyListCache,
            [userId]: { items: nextItems, updatedAt: now, cursor, lastAccessAt: now },
          },
        }
      }),

      setHistoryMessagesCache: (userId, conversationId, items, cursor) => set((state) => {
        const key = `${userId}:${conversationId}`
        const trimmedItems = items.slice(-HISTORY_MESSAGE_MAX_PER_CONVERSATION)
        const now = Date.now()
        return {
          historyMessageCache: {
            ...state.historyMessageCache,
            [key]: { items: trimmedItems, updatedAt: now, cursor, lastAccessAt: now },
          },
        }
      }),

      touchHistoryListCache: (userId) => set((state) => {
        const cache = state.historyListCache[userId]
        if (!cache) return state
        return {
          historyListCache: {
            ...state.historyListCache,
            [userId]: { ...cache, lastAccessAt: Date.now() },
          },
        }
      }),

      touchHistoryMessagesCache: (userId, conversationId) => set((state) => {
        const key = `${userId}:${conversationId}`
        const cache = state.historyMessageCache[key]
        if (!cache) return state
        return {
          historyMessageCache: {
            ...state.historyMessageCache,
            [key]: { ...cache, lastAccessAt: Date.now() },
          },
        }
      }),

      removeConversationCache: (userId, conversationId) => set((state) => {
        const key = `${userId}:${conversationId}`
        const historyMessageCache = { ...state.historyMessageCache }
        delete historyMessageCache[key]
        return { historyMessageCache }
      }),

      invalidateHistoryListCache: (userId) => set((state) => {
        const historyListCache = { ...state.historyListCache }
        delete historyListCache[userId]
        return { historyListCache }
      }),

      updateMessageRatingCache: (userId, conversationId, messageId, rating, feedback) => set((state) => {
        const key = `${userId}:${conversationId}`
        const cache = state.historyMessageCache[key]
        if (!cache) return state
        return {
          historyMessageCache: {
            ...state.historyMessageCache,
            [key]: {
              ...cache,
              lastAccessAt: Date.now(),
              updatedAt: Date.now(),
              items: cache.items.map((message) => message.id === messageId
                ? {
                  ...message,
                  rating: rating ? { id: `local-${messageId}`, rating, feedback: feedback ?? null } : null,
                } as Message
                : message),
            },
          },
        }
      }),

      clearHistoryCacheForUser: (userId) => set((state) => {
        const historyListCache = { ...state.historyListCache }
        const historyMessageCache = { ...state.historyMessageCache }
        delete historyListCache[userId]
        Object.keys(historyMessageCache).forEach((key) => {
          if (key.startsWith(`${userId}:`)) {
            delete historyMessageCache[key]
          }
        })
        return { historyListCache, historyMessageCache }
      }),

      pruneExpiredCache: () => set((state) => {
        const now = Date.now()
        const historyListCache = Object.fromEntries(
          Object.entries(state.historyListCache).filter(([, value]) => now - value.updatedAt <= HISTORY_CACHE_TTL_MS)
        )
        const historyMessageCache = Object.fromEntries(
          Object.entries(state.historyMessageCache).filter(([, value]) => now - value.updatedAt <= HISTORY_CACHE_TTL_MS)
        )
        return { historyListCache, historyMessageCache }
      }),

      enforceCacheLimits: () => set((state) => {
        return pruneHistoryCachesForLimits(
          state.historyListCache,
          state.historyMessageCache,
          { currentUserId: state.currentUserId, conversations: state.conversations }
        )
      }),

      resetForUser: (userId) => set((state) => {
        if (!userId) {
          return initialState
        }

        if (state.currentUserId === userId) {
          return state
        }

        return {
          ...initialState,
          currentUserId: userId,
        }
      }),

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

      reset: () => set(initialState),
    }),
    {
      name: 'conversation-storage',
      storage: createJSONStorage(() => createConversationStorageAdapter()),
      // Only persist conversations list, not messages or loading states
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        conversations: state.conversations,
        historyListCache: state.historyListCache,
        historyMessageCache: state.historyMessageCache,
      }),
      // Migrate function to fix corrupted state
      migrate: (persistedState: any, _version: number) => {
        // Ensure conversations is always an array
        if (persistedState && !Array.isArray(persistedState.conversations)) {
          persistedState.conversations = []
        }
        return persistedState as ConversationState
      },
      version: 3, // Bump version to clear old state
    }
  )
)
