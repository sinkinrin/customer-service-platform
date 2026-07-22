import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketUpdatesProvider } from '@/components/providers/ticket-updates-provider'
import { useTicketSSE } from '@/lib/hooks/use-ticket-sse'
import { useTicketUpdates } from '@/lib/hooks/use-ticket-updates'

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/tickets',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: { info: vi.fn() },
}))

vi.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'staff-1', role: 'staff' } }),
}))

vi.mock('@/lib/stores/unread-store', () => ({
  useUnreadStore: () => ({ incrementCount: vi.fn() }),
}))

vi.mock('@/lib/hooks/use-ticket-sse', () => ({
  useTicketSSE: vi.fn(),
}))

vi.mock('@/lib/hooks/use-ticket-updates', () => ({
  useTicketUpdates: vi.fn(),
}))

describe('TicketUpdatesProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTicketSSE).mockReturnValue({
      isConnected: false,
      error: null,
      reconnectAttempts: 0,
    })
    vi.mocked(useTicketUpdates).mockReturnValue({
      updates: [],
      isPolling: false,
      lastSyncTime: null,
      error: null,
    })
  })

  it('keeps backup polling enabled after SSE connects', async () => {
    render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    const sseOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]
    expect(sseOptions).toBeDefined()

    act(() => {
      sseOptions?.onConnectionChange?.(true)
    })

    await waitFor(() => {
      const pollingOptions = vi.mocked(useTicketUpdates).mock.calls.at(-1)?.[0]
      expect(pollingOptions?.enabled).toBe(true)
    })
  })
})
