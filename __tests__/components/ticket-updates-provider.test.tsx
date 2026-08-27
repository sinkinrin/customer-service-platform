import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketUpdatesProvider } from '@/components/providers/ticket-updates-provider'
import { useTicketSSE } from '@/lib/hooks/use-ticket-sse'
import {
  claimTicketUpdateForProcessing,
  TicketUpdate,
  useTicketUpdates,
} from '@/lib/hooks/use-ticket-updates'
import { toast } from 'sonner'

const authState = vi.hoisted<{
  user: {
    id: string
    email: string
    role: 'admin' | 'staff' | 'customer'
    zammad_id?: number
    region?: string
    group_ids?: number[]
  }
}>(() => ({
  user: { id: 'staff-1', email: 'staff-1@example.com', role: 'staff' },
}))

const providerMocks = vi.hoisted(() => ({
  incrementCount: vi.fn(),
  mutate: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/tickets',
  useRouter: () => ({ push: providerMocks.push }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), dismiss: vi.fn() },
}))

vi.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: providerMocks.mutate }),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: authState.user }),
}))

vi.mock('@/lib/stores/unread-store', () => ({
  useUnreadStore: () => ({ incrementCount: providerMocks.incrementCount }),
}))

vi.mock('@/lib/hooks/use-ticket-sse', () => ({
  useTicketSSE: vi.fn(),
}))

vi.mock('@/lib/hooks/use-ticket-updates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-ticket-updates')>()
  return {
    ...actual,
    claimTicketUpdateForProcessing: vi.fn(actual.claimTicketUpdateForProcessing),
    useTicketUpdates: vi.fn(),
  }
})

describe('TicketUpdatesProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    authState.user = { id: 'staff-1', email: 'staff-1@example.com', role: 'staff' }
    vi.mocked(toast.info).mockReturnValue('provider-ticket-toast')
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
    authState.user = {
      id: 'staff-1',
      email: 'staff-1@example.com',
      role: 'staff',
      zammad_id: 55,
      region: 'asia-pacific',
      group_ids: [4, 2],
    }
    render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    const sseOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]
    expect(sseOptions).toBeDefined()
    const expectedIdentityKey = JSON.stringify({
      id: 'staff-1',
      email: 'staff-1@example.com',
      role: 'staff',
      zammadId: 55,
      region: 'asia-pacific',
      groupIds: [2, 4],
    })
    expect(sseOptions?.subscriptionKey).toBe(expectedIdentityKey)

    act(() => {
      sseOptions?.onConnectionChange?.(true)
    })

    await waitFor(() => {
      const pollingOptions = vi.mocked(useTicketUpdates).mock.calls.at(-1)?.[0]
      expect(pollingOptions?.enabled).toBe(true)
      expect(pollingOptions?.userId).toBe('staff-1')
      expect(pollingOptions?.identityKey).toBe(expectedIdentityKey)
    })
  })

  it('refreshes the current tab even when another tab owns the global claim', async () => {
    vi.mocked(claimTicketUpdateForProcessing).mockResolvedValueOnce(false)
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')
    const update: TicketUpdate = {
      id: 'claimed-in-another-tab',
      ticketId: 41,
      event: 'article_created',
      data: { senderEmail: 'customer@example.com' },
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    const sseOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]
    act(() => {
      sseOptions?.onUpdate?.(update)
    })

    await waitFor(() => {
      expect(claimTicketUpdateForProcessing).toHaveBeenCalledWith(
        update.id,
        'staff-1',
        expect.any(Function)
      )
    })

    expect(providerMocks.mutate).toHaveBeenCalledTimes(2)
    expect(providerMocks.incrementCount).toHaveBeenCalledWith(update.ticketId)
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ticket-update',
      detail: {
        ticketId: update.ticketId,
        event: update.event,
        data: update.data,
      },
    }))
    const claimCallOrder = vi.mocked(claimTicketUpdateForProcessing).mock.invocationCallOrder[0]
    const ticketEventCallIndex = dispatchEvent.mock.calls.findIndex(
      ([event]) => event.type === 'ticket-update'
    )
    expect(providerMocks.mutate.mock.invocationCallOrder[0]).toBeLessThan(claimCallOrder)
    expect(providerMocks.incrementCount.mock.invocationCallOrder[0]).toBeLessThan(claimCallOrder)
    expect(dispatchEvent.mock.invocationCallOrder[ticketEventCallIndex]).toBeLessThan(claimCallOrder)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('deduplicates the same SSE and polling update inside one tab', async () => {
    vi.mocked(claimTicketUpdateForProcessing)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')
    const update: TicketUpdate = {
      id: 'same-tab-sse-polling-update',
      ticketId: 42,
      event: 'article_created',
      data: { senderEmail: 'customer@example.com' },
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    const sseOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]
    const pollingOptions = vi.mocked(useTicketUpdates).mock.calls.at(-1)?.[0]
    await act(async () => {
      sseOptions?.onUpdate?.(update)
      pollingOptions?.onUpdate?.([update])
      await Promise.resolve()
    })

    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(1))
    expect(claimTicketUpdateForProcessing).toHaveBeenCalledTimes(2)
    expect(providerMocks.mutate).toHaveBeenCalledTimes(2)
    expect(providerMocks.incrementCount).toHaveBeenCalledTimes(1)
    expect(providerMocks.incrementCount).toHaveBeenCalledWith(update.ticketId)
    expect(dispatchEvent.mock.calls.filter(([event]) => event.type === 'ticket-update')).toHaveLength(1)
  })

  it('does not replay an SSE update when polling resumes after one minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-28T00:00:00Z'))
    const update: TicketUpdate = {
      id: 'provider-long-lived-update',
      ticketId: 42,
      event: 'article_created',
      data: { senderEmail: 'customer@example.com' },
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    const { unmount } = render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    const firstSSEOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]
    await act(async () => {
      firstSSEOptions?.onUpdate?.(update)
    })

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledTimes(1)
    })

    vi.setSystemTime(new Date('2026-07-28T00:01:01Z'))
    unmount()

    render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    const pollingOptions = vi.mocked(useTicketUpdates).mock.calls.at(-1)?.[0]
    await act(async () => {
      pollingOptions?.onUpdate?.([update])
    })

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledTimes(1)
    })
  })

  it('drops an in-flight update when the authenticated identity changes', async () => {
    let resolveClaim!: (claimed: boolean) => void
    const claim = new Promise<boolean>((resolve) => {
      resolveClaim = resolve
    })
    vi.mocked(claimTicketUpdateForProcessing).mockReturnValueOnce(claim)

    const update: TicketUpdate = {
      id: 'old-user-update',
      ticketId: 84,
      event: 'article_created',
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    const view = render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )
    const oldSSEOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]

    act(() => {
      oldSSEOptions?.onUpdate?.(update)
    })
    await waitFor(() => {
      expect(claimTicketUpdateForProcessing).toHaveBeenCalledWith(
        update.id,
        'staff-1',
        expect.any(Function)
      )
    })
    const oldIdentityEligibility = vi.mocked(claimTicketUpdateForProcessing).mock.calls[0][2]
    expect(oldIdentityEligibility?.()).toBe(true)

    authState.user = { id: 'staff-2', email: 'staff-2@example.com', role: 'staff' }
    view.rerender(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )
    expect(oldIdentityEligibility?.()).toBe(false)

    await act(async () => {
      resolveClaim(true)
      await claim
    })

    expect(toast.info).not.toHaveBeenCalled()

    // A callback retained by the old connection is rejected before claiming.
    act(() => {
      oldSSEOptions?.onUpdate?.({ ...update, id: 'late-old-callback' })
    })
    await Promise.resolve()
    expect(claimTicketUpdateForProcessing).toHaveBeenCalledTimes(1)
  })

  it('drops an in-flight update when only the authorization context changes', async () => {
    authState.user = {
      id: 'staff-1',
      email: 'staff-1@example.com',
      role: 'staff',
      zammad_id: 55,
      region: 'region-a',
      group_ids: [2],
    }
    let resolveClaim!: (claimed: boolean) => void
    const claim = new Promise<boolean>((resolve) => {
      resolveClaim = resolve
    })
    vi.mocked(claimTicketUpdateForProcessing).mockReturnValueOnce(claim)
    const update: TicketUpdate = {
      id: 'old-authz-update',
      ticketId: 85,
      event: 'article_created',
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    const view = render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )
    const oldSSEOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]

    act(() => {
      oldSSEOptions?.onUpdate?.(update)
    })
    await waitFor(() => {
      expect(claimTicketUpdateForProcessing).toHaveBeenCalledWith(
        update.id,
        'staff-1',
        expect.any(Function)
      )
    })
    const oldAuthorizationEligibility = vi.mocked(claimTicketUpdateForProcessing).mock.calls[0][2]
    expect(oldAuthorizationEligibility?.()).toBe(true)

    authState.user = {
      id: 'staff-1',
      email: 'staff-1@example.com',
      role: 'staff',
      zammad_id: 55,
      region: 'region-b',
      group_ids: [3],
    }
    view.rerender(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )
    expect(oldAuthorizationEligibility?.()).toBe(false)

    await act(async () => {
      resolveClaim(true)
      await claim
    })

    expect(toast.info).not.toHaveBeenCalled()

    act(() => {
      oldSSEOptions?.onUpdate?.({ ...update, id: 'late-old-authz-callback' })
    })
    await Promise.resolve()
    expect(claimTicketUpdateForProcessing).toHaveBeenCalledTimes(1)
  })

  it("dismisses this provider's ticket toasts when the user identity changes", async () => {
    const update: TicketUpdate = {
      id: 'visible-old-user-toast',
      ticketId: 126,
      event: 'created',
      data: { title: 'Old user ticket' },
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    const view = render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )
    const oldSSEOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]

    act(() => {
      oldSSEOptions?.onUpdate?.(update)
    })
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledTimes(1)
    })

    authState.user = { id: 'staff-2', email: 'staff-2@example.com', role: 'staff' }
    view.rerender(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    expect(toast.dismiss).toHaveBeenCalledTimes(1)
    expect(toast.dismiss).toHaveBeenCalledWith('provider-ticket-toast')
  })

  it("dismisses this provider's ticket toasts when the same user's role changes", async () => {
    const update: TicketUpdate = {
      id: 'visible-old-role-toast',
      ticketId: 127,
      event: 'created',
      data: { title: 'Old role ticket' },
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    const view = render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )
    const oldSSEOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]

    act(() => {
      oldSSEOptions?.onUpdate?.(update)
    })
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledTimes(1)
    })

    authState.user = { id: 'staff-1', email: 'staff-1@example.com', role: 'admin' }
    view.rerender(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    expect(toast.dismiss).toHaveBeenCalledTimes(1)
    expect(toast.dismiss).toHaveBeenCalledWith('provider-ticket-toast')
  })

  it("dismisses this provider's ticket toasts when only authorization context changes", async () => {
    authState.user = {
      id: 'staff-1',
      email: 'staff-1@example.com',
      role: 'staff',
      zammad_id: 55,
      region: 'region-a',
      group_ids: [2],
    }
    const update: TicketUpdate = {
      id: 'visible-old-authz-toast',
      ticketId: 128,
      event: 'created',
      data: { title: 'Old authorization ticket' },
      createdAt: '2026-07-28T00:00:00.000Z',
    }

    const view = render(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )
    const oldSSEOptions = vi.mocked(useTicketSSE).mock.calls.at(-1)?.[0]

    act(() => {
      oldSSEOptions?.onUpdate?.(update)
    })
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledTimes(1)
    })

    authState.user = {
      id: 'staff-1',
      email: 'staff-1@example.com',
      role: 'staff',
      zammad_id: 55,
      region: 'region-b',
      group_ids: [3],
    }
    view.rerender(
      <TicketUpdatesProvider>
        <div>content</div>
      </TicketUpdatesProvider>
    )

    expect(toast.dismiss).toHaveBeenCalledTimes(1)
    expect(toast.dismiss).toHaveBeenCalledWith('provider-ticket-toast')
  })
})
