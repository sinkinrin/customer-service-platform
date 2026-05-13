import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationHeader } from '@/components/conversation/conversation-header'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

describe('ConversationHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('click new conversation only navigates to draft route', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationHeader currentConversationId="conv-1" />)

    await user.click(screen.getByRole('button', { name: /buttons.newConversation/i }))

    expect(mockPush).toHaveBeenCalledWith('/customer/conversations/new')
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/conversations',
      expect.anything()
    )
  })
})
