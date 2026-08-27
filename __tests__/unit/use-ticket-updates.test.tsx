import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLastSyncStorageKey,
  TicketUpdate,
  useTicketUpdates,
} from '@/lib/hooks/use-ticket-updates'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function updatesResponse(serverTime: number, updateId: string): Response {
  const update: TicketUpdate = {
    id: updateId,
    ticketId: serverTime,
    event: 'status_changed',
    createdAt: new Date(serverTime).toISOString(),
  }

  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { updates: [update], serverTime },
    }),
  } as Response
}

describe('useTicketUpdates request lifecycle', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('aborts and ignores the previous user response after identity changes', async () => {
    const previousResponse = deferred<Response>()
    const currentResponse = deferred<Response>()
    const previousOnUpdate = vi.fn()
    const currentOnUpdate = vi.fn()
    fetchMock
      .mockReturnValueOnce(previousResponse.promise)
      .mockReturnValueOnce(currentResponse.promise)

    const view = renderHook(
      ({ userId, onUpdate }) => useTicketUpdates({ enabled: true, userId, onUpdate }),
      {
        initialProps: { userId: 'user-a', onUpdate: previousOnUpdate },
      }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const previousSignal = fetchMock.mock.calls[0][1]?.signal as AbortSignal

    view.rerender({ userId: 'user-b', onUpdate: currentOnUpdate })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(previousSignal.aborted).toBe(true)

    await act(async () => {
      previousResponse.resolve(updatesResponse(101, 'old-user-update'))
      await previousResponse.promise
      await Promise.resolve()
    })

    expect(previousOnUpdate).not.toHaveBeenCalled()
    expect(currentOnUpdate).not.toHaveBeenCalled()
    expect(localStorage.getItem(getLastSyncStorageKey('user-a'))).toBeNull()

    await act(async () => {
      currentResponse.resolve(updatesResponse(202, 'current-user-update'))
      await currentResponse.promise
    })

    await waitFor(() => {
      expect(currentOnUpdate).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'current-user-update' }),
      ])
      expect(view.result.current.lastSyncTime).toBe(202)
    })
    expect(localStorage.getItem(getLastSyncStorageKey('user-b'))).toBe('202')
  })

  it('aborts and ignores the previous role response for the same user', async () => {
    const previousResponse = deferred<Response>()
    const currentResponse = deferred<Response>()
    const previousOnUpdate = vi.fn()
    const currentOnUpdate = vi.fn()
    fetchMock
      .mockReturnValueOnce(previousResponse.promise)
      .mockReturnValueOnce(currentResponse.promise)

    const view = renderHook(
      ({ role, onUpdate }) => useTicketUpdates({
        enabled: true,
        userId: 'same-user',
        identityKey: `same-user:${role}`,
        onUpdate,
      }),
      {
        initialProps: { role: 'staff', onUpdate: previousOnUpdate },
      }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const previousSignal = fetchMock.mock.calls[0][1]?.signal as AbortSignal

    view.rerender({ role: 'admin', onUpdate: currentOnUpdate })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    expect(previousSignal.aborted).toBe(true)

    await act(async () => {
      previousResponse.resolve(updatesResponse(211, 'old-role-update'))
      await previousResponse.promise
      await Promise.resolve()
    })

    expect(previousOnUpdate).not.toHaveBeenCalled()
    expect(currentOnUpdate).not.toHaveBeenCalled()
    expect(localStorage.getItem(getLastSyncStorageKey('same-user'))).toBeNull()

    await act(async () => {
      currentResponse.resolve(updatesResponse(212, 'current-role-update'))
      await currentResponse.promise
    })

    await waitFor(() => {
      expect(currentOnUpdate).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'current-role-update' }),
      ])
      expect(view.result.current.lastSyncTime).toBe(212)
    })
    expect(localStorage.getItem(getLastSyncStorageKey('same-user'))).toBe('212')
  })

  it('continues polling when reading last-sync storage throws a SecurityError', async () => {
    const onUpdate = vi.fn()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    fetchMock.mockResolvedValue(updatesResponse(250, 'storage-read-update'))

    const view = renderHook(() => useTicketUpdates({
      enabled: true,
      userId: 'storage-read-user',
      identityKey: 'storage-read-user:staff',
      onUpdate,
    }))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'storage-read-update' }),
      ])
      expect(view.result.current.lastSyncTime).toBe(250)
    })
  })

  it('keeps the in-memory cursor and dispatches updates when storage writes fail', async () => {
    const onUpdate = vi.fn()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    fetchMock.mockResolvedValue(updatesResponse(260, 'storage-write-update'))

    const view = renderHook(() => useTicketUpdates({
      enabled: true,
      userId: 'storage-write-user',
      identityKey: 'storage-write-user:staff',
      onUpdate,
    }))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'storage-write-update' }),
      ])
      expect(view.result.current.lastSyncTime).toBe(260)
    })
  })

  it('does not abort a slow request when a regular interval tick fires', async () => {
    vi.useFakeTimers()
    const response = deferred<Response>()
    const onUpdate = vi.fn()
    fetchMock.mockReturnValueOnce(response.promise)

    const view = renderHook(() => useTicketUpdates({
      enabled: true,
      userId: 'slow-user',
      identityKey: 'slow-user:staff',
      onUpdate,
    }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(signal.aborted).toBe(false)

    await act(async () => {
      response.resolve(updatesResponse(270, 'slow-update'))
      await response.promise
      await Promise.resolve()
    })

    expect(onUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'slow-update' }),
    ])
    expect(view.result.current.lastSyncTime).toBe(270)
    view.unmount()
  })

  it('aborts and ignores an in-flight response when polling is disabled', async () => {
    const response = deferred<Response>()
    const onUpdate = vi.fn()
    fetchMock.mockReturnValueOnce(response.promise)

    const view = renderHook(
      ({ enabled }) => useTicketUpdates({ enabled, userId: 'disable-user', onUpdate }),
      { initialProps: { enabled: true } }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal

    view.rerender({ enabled: false })
    expect(signal.aborted).toBe(true)

    await act(async () => {
      response.resolve(updatesResponse(303, 'disabled-update'))
      await response.promise
      await Promise.resolve()
    })

    expect(onUpdate).not.toHaveBeenCalled()
    expect(view.result.current.updates).toEqual([])
    expect(view.result.current.lastSyncTime).toBeNull()
    expect(view.result.current.isPolling).toBe(false)
    expect(localStorage.getItem(getLastSyncStorageKey('disable-user'))).toBeNull()
  })

  it('aborts an in-flight response on unmount without persisting it', async () => {
    const response = deferred<Response>()
    const onUpdate = vi.fn()
    fetchMock.mockReturnValueOnce(response.promise)

    const view = renderHook(() =>
      useTicketUpdates({ enabled: true, userId: 'unmount-user', onUpdate })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal

    view.unmount()
    expect(signal.aborted).toBe(true)

    response.resolve(updatesResponse(404, 'unmounted-update'))
    await response.promise
    await Promise.resolve()

    expect(onUpdate).not.toHaveBeenCalled()
    expect(localStorage.getItem(getLastSyncStorageKey('unmount-user'))).toBeNull()
  })
})
