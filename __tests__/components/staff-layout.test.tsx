import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StaffLayout } from '@/components/layouts/staff-layout'

let currentPathname = '/staff/tickets'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/notification/notification-center', () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}))

vi.mock('@/components/language-selector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}))

vi.mock('@/lib/hooks/use-notifications', () => ({
  useNotifications: vi.fn(() => ({ unreadCount: 0 })),
}))

describe('StaffLayout', () => {
  beforeEach(() => {
    currentPathname = '/staff/tickets'
  })

  it('shows a staff AI assistant sidebar link', () => {
    render(
      <StaffLayout user={{ id: 'staff-1', email: 'staff@example.com' }}>
        <div>content</div>
      </StaffLayout>
    )

    const link = screen.getByRole('link', { name: /aiAssistant/i })
    expect(link).toHaveAttribute('href', '/staff/conversations')
  })

  it('does not render the notification bell on staff AI assistant pages', () => {
    currentPathname = '/staff/conversations/new'

    render(
      <StaffLayout user={{ id: 'staff-1', email: 'staff@example.com' }}>
        <div>content</div>
      </StaffLayout>
    )

    expect(screen.queryByTestId('notification-center')).toBeNull()
  })
})
