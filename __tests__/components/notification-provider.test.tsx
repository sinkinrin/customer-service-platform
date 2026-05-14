import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { NotificationProvider } from '@/components/providers/notification-provider'
import { useNotifications } from '@/lib/hooks/use-notifications'

vi.mock('@/lib/hooks/use-notifications', () => ({
  useNotifications: vi.fn(),
}))

describe('NotificationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not start duplicate global notification polling', () => {
    render(
      <NotificationProvider>
        <div>content</div>
      </NotificationProvider>
    )

    expect(useNotifications).not.toHaveBeenCalled()
  })
})
