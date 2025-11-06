/**
 * Authentication Store (Zustand)
 *
 * Global state management for authentication
 * Now uses cookies for persistence instead of localStorage
 *
 * TODO: Replace mock types with real authentication types
 */

import { create } from 'zustand'
import type { MockUser, MockSession } from '@/lib/mock-auth'

interface AuthState {
  user: MockUser | null
  session: MockSession | null
  userRole: 'customer' | 'staff' | 'admin' | null
  isLoading: boolean
  isInitialized: boolean
}

interface AuthActions {
  setUser: (user: MockUser | null) => void
  setSession: (session: MockSession | null) => void
  setUserRole: (role: 'customer' | 'staff' | 'admin' | null) => void
  setLoading: (isLoading: boolean) => void
  setInitialized: (isInitialized: boolean) => void
  reset: () => void
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  user: null,
  session: null,
  userRole: null,
  isLoading: true,
  isInitialized: false,
}

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),

  setSession: (session) => set({ session }),

  setUserRole: (userRole) => set({ userRole }),

  setLoading: (isLoading) => set({ isLoading }),

  setInitialized: (isInitialized) => set({ isInitialized }),

  reset: () => set(initialState),
}))

