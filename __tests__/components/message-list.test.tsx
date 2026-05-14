import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageList } from '@/components/conversation/message-list'
import type { Message } from '@/lib/stores/conversation-store'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

describe('MessageList', () => {
  it('renders staff current-user assistant prompts as own-side messages', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const messages: Message[] = [
      {
        id: 'staff-msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user',
        content: 'staff prompt',
        message_type: 'text',
        metadata: { aiMode: true, role: 'staff' },
        created_at: new Date().toISOString(),
        sender: {
          id: 'user',
          full_name: 'Staff User',
          role: 'staff',
        },
      },
    ]

    render(<MessageList messages={messages} />)

    const prompt = screen.getByText('staff prompt')
    expect(prompt).toHaveClass('text-white')
    expect(prompt.closest('.bg-primary')).not.toBeNull()
  })
})
