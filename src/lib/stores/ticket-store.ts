import { create } from 'zustand'

export interface ZammadTicket {
  id: number
  number: string
  title: string
  state_id: number
  state: string
  priority_id: number
  priority: string
  group: string
  group_id?: number
  customer: string
  owner_id?: number
  owner_name?: string // Display name of assigned staff
  created_at: string
  updated_at: string
}

export interface TicketFilters {
  status?: string
  priority?: string
  search?: string
}

interface TicketStore {
  tickets: ZammadTicket[]
  selectedTicket: ZammadTicket | null
  filters: TicketFilters
  setTickets: (tickets: ZammadTicket[]) => void
  setSelectedTicket: (ticket: ZammadTicket | null) => void
  setFilters: (filters: TicketFilters) => void
  clearFilters: () => void
}

export const useTicketStore = create<TicketStore>((set) => ({
  tickets: [],
  selectedTicket: null,
  filters: {},
  setTickets: (tickets) => set({ tickets }),
  setSelectedTicket: (ticket) => set({ selectedTicket: ticket }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: {} }),
}))

