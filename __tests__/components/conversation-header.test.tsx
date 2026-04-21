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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe('ConversationHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not close the current conversation before a new one is created successfully', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<ConversationHeader currentConversationId="conv-1" />)

    await user.click(screen.getByRole('button', { name: /buttons.newConversation/i }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/conversations',
      expect.objectContaining({ method: 'POST' })
    )
    expect(mockPush).not.toHaveBeenCalled()
  })
})
