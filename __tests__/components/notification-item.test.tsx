import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationItem } from '@/components/notification/notification-item'

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

describe('NotificationItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not navigate until user role is known', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({ userRole: null })
    const onRead = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <NotificationItem
        notification={{
          id: 'n1',
          title: 'Ticket updated',
          body: 'A reply arrived',
          read: false,
          createdAt: '2024-01-01T00:00:00Z',
          data: { ticketId: 123 },
        } as any}
        onRead={onRead}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole('button', { name: /ticket updated/i }))

    expect(onRead).toHaveBeenCalledWith('n1')
    expect(mockPush).not.toHaveBeenCalled()
  })
})
