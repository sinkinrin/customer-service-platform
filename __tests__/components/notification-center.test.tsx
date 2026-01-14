import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationCenter } from '@/components/notification/notification-center'

const mockUseNotifications = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const dict: Record<string, string> = {
      title: 'Notifications',
      markAllRead: 'Mark all read',
      empty: 'Empty',
      loading: 'Loading...',
      view: 'View',
    }
    return (key: string) => dict[key] ?? key
  },
}))

vi.mock('@/lib/hooks/use-notifications', () => ({
  useNotifications: () => mockUseNotifications(),
}))

describe('NotificationCenter', () => {
  beforeAll(() => {
    ;(globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 3,
      isLoading: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    })
  })

  it('shows unread badge and opens dropdown', () => {
    render(<NotificationCenter />)

    expect(screen.getByText('3')).toBeInTheDocument()

    const trigger = screen.getByRole('button')
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Mark all read')).toBeInTheDocument()
  })
})
