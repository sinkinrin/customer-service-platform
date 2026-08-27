import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketUpdate } from '@/lib/hooks/use-ticket-updates'
import { useTicketSSE } from '@/lib/hooks/use-ticket-sse'

type MockListener = (event: MessageEvent) => void

class MockEventSource {
  static instances: MockEventSource[] = []

  readonly url: string
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readonly close = vi.fn()
  private listeners = new Map<string, Set<MockListener>>()

  constructor(url: string | URL) {
    this.url = String(url)
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: MockListener) {
    const listeners = this.listeners.get(type) ?? new Set<MockListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  emitOpen() {
    this.onopen?.(new Event('open'))
  }

  emitError() {
    this.onerror?.(new Event('error'))
  }

  emitTicketUpdate(update: TicketUpdate) {
    const event = { data: JSON.stringify(update) } as MessageEvent
    for (const listener of this.listeners.get('ticket-update') ?? []) {
      listener(event)
    }
  }
}

describe('useTicketSSE identity lifecycle', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('closes the old role subscription, ignores its listeners, and uses the new connection', async () => {
    const previousOnUpdate = vi.fn()
    const currentOnUpdate = vi.fn()
    const previousOnConnectionChange = vi.fn()
    const currentOnConnectionChange = vi.fn()
    const oldUpdate: TicketUpdate = {
      id: 'old-role-update',
      ticketId: 1,
      event: 'status_changed',
      createdAt: '2026-07-28T00:00:00.000Z',
    }
    const currentUpdate: TicketUpdate = {
      id: 'current-role-update',
      ticketId: 2,
      event: 'status_changed',
      createdAt: '2026-07-28T00:01:00.000Z',
    }

    const view = renderHook(
      ({ role, onUpdate, onConnectionChange }) => useTicketSSE({
        enabled: true,
        subscriptionKey: `staff-1:${role}`,
        onUpdate,
        onConnectionChange,
      }),
      {
        initialProps: {
          role: 'staff',
          onUpdate: previousOnUpdate,
          onConnectionChange: previousOnConnectionChange,
        },
      }
    )

    expect(MockEventSource.instances).toHaveLength(1)
    const oldConnection = MockEventSource.instances[0]

    act(() => {
      oldConnection.emitOpen()
      oldConnection.emitTicketUpdate(oldUpdate)
    })
    expect(previousOnConnectionChange).toHaveBeenCalledWith(true)
    expect(previousOnUpdate).toHaveBeenCalledWith(oldUpdate)

    view.rerender({
      role: 'admin',
      onUpdate: currentOnUpdate,
      onConnectionChange: currentOnConnectionChange,
    })

    await waitFor(() => {
      expect(oldConnection.close).toHaveBeenCalledTimes(1)
      expect(MockEventSource.instances).toHaveLength(2)
    })
    expect(view.result.current.isConnected).toBe(false)

    act(() => {
      oldConnection.emitOpen()
      oldConnection.emitTicketUpdate({ ...oldUpdate, id: 'late-old-role-update' })
      oldConnection.emitError()
    })

    expect(previousOnUpdate).toHaveBeenCalledTimes(1)
    expect(currentOnUpdate).not.toHaveBeenCalled()
    expect(currentOnConnectionChange).not.toHaveBeenCalled()

    const currentConnection = MockEventSource.instances[1]
    act(() => {
      currentConnection.emitOpen()
      currentConnection.emitTicketUpdate(currentUpdate)
    })

    expect(currentOnConnectionChange).toHaveBeenCalledWith(true)
    expect(currentOnUpdate).toHaveBeenCalledWith(currentUpdate)
    expect(view.result.current.isConnected).toBe(true)
  })
})
