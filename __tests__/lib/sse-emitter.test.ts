import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SSEEmitter } from '@/lib/sse/emitter'

describe('SSEEmitter connection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('removes a subscriber that has no delivery or heartbeat activity', async () => {
    const emitter = new SSEEmitter()
    emitter.subscribe('user-1', 'customer', vi.fn())

    await vi.advanceTimersByTimeAsync(11 * 60 * 1000)

    expect(emitter.getSubscriberCount()).toBe(0)
    emitter.dispose()
  })

  it('keeps an idle subscriber while the stream heartbeat is active', async () => {
    const emitter = new SSEEmitter()
    const subscription = emitter.subscribe('user-1', 'customer', vi.fn())

    expect(subscription).not.toBeNull()

    await vi.advanceTimersByTimeAsync(9 * 60 * 1000)
    subscription?.touch()
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)

    expect(emitter.getSubscriberCount()).toBe(1)
    subscription?.unsubscribe()
    emitter.dispose()
  })
})
