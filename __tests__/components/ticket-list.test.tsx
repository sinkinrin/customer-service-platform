import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketList } from '@/components/ticket/ticket-list'

const mockPush = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('TicketList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { role: 'staff' },
    })
  })

  it('renders a keyboard-accessible ticket entry', async () => {
    const user = userEvent.setup()

    render(
      <TicketList
        tickets={[
          {
            id: 1,
            number: '10001',
            title: 'Example ticket',
            customer: 'customer@test.com',
            state: 'open',
            priority: '2 normal',
            priority_id: 2,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            group: 'Support',
            owner_id: 10,
            owner_name: 'Agent One',
          },
        ] as any}
      />
    )

    const ticketEntry = screen.getByRole('link', { name: /10001 - example ticket/i })
    expect(ticketEntry).toHaveAttribute('tabindex', '0')

    ticketEntry.focus()
    await user.keyboard('{Enter}')

    expect(mockPush).toHaveBeenCalledWith('/staff/tickets/1')
  })
})
