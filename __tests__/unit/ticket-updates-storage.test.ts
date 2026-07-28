import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  claimTicketUpdateForProcessing,
  getLastSyncStorageKey,
  getProcessedUpdatesStorageKey,
} from '@/lib/hooks/use-ticket-updates'

describe('ticket updates storage key', () => {
  it('namespaces the sync cursor by user id', () => {
    expect(getLastSyncStorageKey('user-a')).toBe('ticket-updates-last-sync:user-a')
    expect(getLastSyncStorageKey('user-b')).toBe('ticket-updates-last-sync:user-b')
  })

  it('uses an anonymous fallback when user id is missing', () => {
    expect(getLastSyncStorageKey()).toBe('ticket-updates-last-sync:anonymous')
  })
})

describe('ticket update processing registry', () => {
  const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalLocksDescriptor) {
      Object.defineProperty(navigator, 'locks', originalLocksDescriptor)
    } else {
      Reflect.deleteProperty(navigator, 'locks')
    }
  })

  it('namespaces processed update IDs by user', async () => {
    expect(getProcessedUpdatesStorageKey('user-a')).toBe('ticket-updates-processed:user-a')
    expect(getProcessedUpdatesStorageKey('user-b')).toBe('ticket-updates-processed:user-b')

    await expect(claimTicketUpdateForProcessing('shared-update', 'dedup-user-a')).resolves.toBe(true)
    await expect(claimTicketUpdateForProcessing('shared-update', 'dedup-user-a')).resolves.toBe(false)
    await expect(claimTicketUpdateForProcessing('shared-update', 'dedup-user-b')).resolves.toBe(true)
  })

  it('keeps an update claimed after the former one-minute window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T00:00:00Z'))

    await expect(
      claimTicketUpdateForProcessing('long-lived-update', 'dedup-long-lived')
    ).resolves.toBe(true)

    vi.advanceTimersByTime(61_000)

    await expect(
      claimTicketUpdateForProcessing('long-lived-update', 'dedup-long-lived')
    ).resolves.toBe(false)
  })

  it('serializes the same user and update ID with Web Locks', async () => {
    let activeCallbacks = 0
    let maxActiveCallbacks = 0
    let tail = Promise.resolve()

    const request = vi.fn((lockName: string, callback: () => boolean | Promise<boolean>) => {
      const result = tail.then(async () => {
        activeCallbacks += 1
        maxActiveCallbacks = Math.max(maxActiveCallbacks, activeCallbacks)

        try {
          await Promise.resolve()
          return await callback()
        } finally {
          activeCallbacks -= 1
        }
      })

      tail = result.then(() => undefined, () => undefined)
      return result
    })

    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    })

    const results = await Promise.all([
      claimTicketUpdateForProcessing('serialized-update', 'serialized-user'),
      claimTicketUpdateForProcessing('serialized-update', 'serialized-user'),
    ])

    expect(results).toEqual([true, false])
    expect(maxActiveCallbacks).toBe(1)
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0][0]).toBe(request.mock.calls[1][0])
  })

  it('serializes different IDs in one user registry without losing either claim', async () => {
    let tail = Promise.resolve()
    const request = vi.fn((lockName: string, callback: () => boolean | Promise<boolean>) => {
      const result = tail.then(async () => {
        await Promise.resolve()
        return callback()
      })
      tail = result.then(() => undefined, () => undefined)
      return result
    })

    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    })

    const userId = 'multi-id-user'
    const results = await Promise.all([
      claimTicketUpdateForProcessing('concurrent-update-a', userId),
      claimTicketUpdateForProcessing('concurrent-update-b', userId),
    ])

    expect(results).toEqual([true, true])
    expect(request.mock.calls[0][0]).toBe(getProcessedUpdatesStorageKey(userId))
    expect(request.mock.calls[1][0]).toBe(getProcessedUpdatesStorageKey(userId))

    const stored = JSON.parse(
      localStorage.getItem(getProcessedUpdatesStorageKey(userId)) || '[]'
    ) as Array<{ id: string }>
    expect(stored.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['concurrent-update-a', 'concurrent-update-b'])
    )

    await expect(
      claimTicketUpdateForProcessing('concurrent-update-a', userId)
    ).resolves.toBe(false)
    await expect(
      claimTicketUpdateForProcessing('concurrent-update-b', userId)
    ).resolves.toBe(false)
  })

  it('does not persist a claim when eligibility changes before the Web Lock is acquired', async () => {
    let releaseLock!: () => void
    const lockGate = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    const request = vi.fn(async (
      _lockName: string,
      callback: () => boolean | Promise<boolean>
    ) => {
      await lockGate
      return callback()
    })

    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    })

    const userId = 'identity-transition-user'
    const updateId = 'identity-transition-update'
    let eligible = true
    const pendingClaim = claimTicketUpdateForProcessing(
      updateId,
      userId,
      () => eligible
    )

    expect(request).toHaveBeenCalledTimes(1)
    eligible = false
    releaseLock()

    await expect(pendingClaim).resolves.toBe(false)
    expect(localStorage.getItem(getProcessedUpdatesStorageKey(userId))).toBeNull()
    await expect(
      claimTicketUpdateForProcessing(updateId, userId)
    ).resolves.toBe(true)
  })
})
