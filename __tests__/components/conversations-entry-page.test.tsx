import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ConversationsPage from '@/app/customer/conversations/page'

const mockReplace = vi.fn()
const mockCreateConversation = vi.fn()
const mockFetchConversations = vi.fn()
const mockUseAuth = vi.fn(() => ({ user: { id: 'user-1' }, isLoading: false }))

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
    createConversation: mockCreateConversation,
    fetchConversations: mockFetchConversations,
  }),
}))

describe('Conversations entry page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, isLoading: false })
    mockCreateConversation.mockResolvedValue({ id: 'conv-new' })
  })

  it('creates new conversation directly without fetching history list first', async () => {
    render(<ConversationsPage />)

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledTimes(1)
    })
    expect(mockFetchConversations).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-new?new=1')
  })

  it('does not create conversation while auth is loading', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    render(<ConversationsPage />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockCreateConversation).not.toHaveBeenCalled()
  })
})
