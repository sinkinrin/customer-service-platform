import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationCenter } from '@/components/notification/notification-center'

const mockUseNotifications = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const dict: Record<string, string> = {
      title: 'Notifications',
      markAllRead: 'Mark all read',
      empty: 'No notifications',
      emptyDescription: 'New notifications will appear here.',
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

  it('shows empty state when no notifications', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    })

    render(<NotificationCenter />)

    const trigger = screen.getByRole('button')
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    // Should show EmptyState with title and description
    expect(screen.getByText('No notifications')).toBeInTheDocument()
    expect(screen.getByText('New notifications will appear here.')).toBeInTheDocument()
    // EmptyState should have data-testid
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('disables mark all read button when no unread notifications', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    })

    render(<NotificationCenter />)

    const trigger = screen.getByRole('button')
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    const markAllReadButton = screen.getByText('Mark all read').closest('button')
    expect(markAllReadButton).toBeDisabled()
  })

  it('shows loading state', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: true,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    })

    render(<NotificationCenter />)

    const trigger = screen.getByRole('button')
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows 99+ for large unread counts', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 150,
      isLoading: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    })

    render(<NotificationCenter />)

    expect(screen.getByText('99+')).toBeInTheDocument()
  })
})
