'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UnreadStore {
  // State
  unreadTickets: number[]
  unreadCounts: Record<number, number>
  
  // Actions
  markAsUnread: (ticketId: number) => void
  markAsRead: (ticketId: number) => void
  incrementCount: (ticketId: number) => void
  clearAll: () => void
  
  // Getters
  isUnread: (ticketId: number) => boolean
  getUnreadCount: (ticketId: number) => number
  getTotalUnread: () => number
}

export const useUnreadStore = create<UnreadStore>()(
  persist(
    (set, get) => ({
      // Initial state
      unreadTickets: [],
      unreadCounts: {},

      // Mark a ticket as unread
      markAsUnread: (ticketId: number) => {
        set((state) => {
          if (state.unreadTickets.includes(ticketId)) {
            return state // Already unread
          }
          return {
            unreadTickets: [...state.unreadTickets, ticketId],
          }
        })
      },

      // Mark a ticket as read
      markAsRead: (ticketId: number) => {
        set((state) => ({
          unreadTickets: state.unreadTickets.filter((id) => id !== ticketId),
          unreadCounts: {
            ...state.unreadCounts,
            [ticketId]: 0,
          },
        }))
      },

      // Increment unread count for a ticket
      incrementCount: (ticketId: number) => {
        set((state) => {
          const currentCount = state.unreadCounts[ticketId] || 0
          const newUnreadTickets = state.unreadTickets.includes(ticketId)
            ? state.unreadTickets
            : [...state.unreadTickets, ticketId]
          
          return {
            unreadTickets: newUnreadTickets,
            unreadCounts: {
              ...state.unreadCounts,
              [ticketId]: currentCount + 1,
            },
          }
        })
      },

      // Clear all unread state
      clearAll: () => {
        set({
          unreadTickets: [],
          unreadCounts: {},
        })
      },

      // Check if a ticket is unread
      isUnread: (ticketId: number) => {
        return get().unreadTickets.includes(ticketId)
      },

      // Get unread count for a ticket
      getUnreadCount: (ticketId: number) => {
        return get().unreadCounts[ticketId] || 0
      },

      // Get total number of unread tickets
      getTotalUnread: () => {
        return get().unreadTickets.length
      },
    }),
    {
      name: 'ticket-unread-store',
      // Only persist unreadTickets and unreadCounts
      partialize: (state) => ({
        unreadTickets: state.unreadTickets,
        unreadCounts: state.unreadCounts,
      }),
    }
  )
)
