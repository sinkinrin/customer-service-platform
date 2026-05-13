import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ConversationsPage from '@/app/customer/conversations/page'

const mockReplace = vi.fn()
const mockFetchConversations = vi.fn()
const mockUseAuth = vi.fn(() => ({ user: { id: 'user-1' }, isLoading: false }))
let mockConversations: any[] = []

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/hooks/use-conversation', () => ({
  useConversation: () => ({
    conversations: mockConversations,
    fetchConversations: mockFetchConversations,
  }),
}))

describe('Conversations entry page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockConversations = []
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, isLoading: false })
  })

  it('navigates to draft conversation without creating conversation', async () => {
    render(<ConversationsPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/new')
    })
    expect(mockFetchConversations).not.toHaveBeenCalled()
  })

  it('reuses recent active conversation without creating a new one', async () => {
    sessionStorage.setItem('conversationLastVisitAt:user-1', String(Date.now()))
    mockFetchConversations.mockResolvedValue([
      {
        id: 'conv-active',
        status: 'active',
        last_message_at: '2026-05-12T00:00:00.000Z',
        created_at: '2026-05-12T00:00:00.000Z',
      },
    ])
    mockConversations = [
      {
        id: 'conv-active',
        status: 'active',
        last_message_at: '2026-05-12T00:00:00.000Z',
        created_at: '2026-05-12T00:00:00.000Z',
      },
    ]

    render(<ConversationsPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-active')
    })
    expect(mockFetchConversations).toHaveBeenCalledWith('active', 20)
  })

  it('in reuse window, refreshes stale local store before deciding target route', async () => {
    sessionStorage.setItem('conversationLastVisitAt:user-1', String(Date.now()))
    mockConversations = [
      {
        id: 'conv-stale-local',
        status: 'active',
        last_message_at: '2026-05-12T00:00:00.000Z',
        created_at: '2026-05-12T00:00:00.000Z',
      },
    ]
    mockFetchConversations.mockResolvedValue([
      {
        id: 'conv-from-server',
        status: 'active',
        last_message_at: '2026-05-12T01:00:00.000Z',
        created_at: '2026-05-12T01:00:00.000Z',
      },
    ])

    render(<ConversationsPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-from-server')
    })
  })

  it('in reuse window, goes to draft when refresh fails instead of blindly reusing stale local active conversation', async () => {
    sessionStorage.setItem('conversationLastVisitAt:user-1', String(Date.now()))
    mockConversations = [
      {
        id: 'conv-stale-local',
        status: 'active',
        last_message_at: '2026-05-12T00:00:00.000Z',
        created_at: '2026-05-12T00:00:00.000Z',
      },
    ]
    mockFetchConversations.mockRejectedValue(new Error('fetch failed'))

    render(<ConversationsPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/new')
    })
  })

  it('does not create conversation while auth is loading', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    render(<ConversationsPage />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
