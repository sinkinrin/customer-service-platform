import { beforeEach, describe, expect, it } from 'vitest'
import { useUnreadStore } from '@/lib/stores/unread-store'

describe('unread store', () => {
  beforeEach(() => {
    useUnreadStore.setState({
      unreadTickets: [],
      unreadCounts: {},
      currentUserId: null,
    })
  })

  it('clears unread state when switching to a different user', () => {
    const store = useUnreadStore.getState()
    store.resetForUser('user-a')
    store.incrementCount(101)

    store.resetForUser('user-b')

    expect(useUnreadStore.getState().currentUserId).toBe('user-b')
    expect(useUnreadStore.getState().unreadTickets).toEqual([])
    expect(useUnreadStore.getState().unreadCounts).toEqual({})
  })

  it('keeps unread state when the same user is rehydrated', () => {
    const store = useUnreadStore.getState()
    store.resetForUser('user-a')
    store.incrementCount(101)

    store.resetForUser('user-a')

    expect(useUnreadStore.getState().currentUserId).toBe('user-a')
    expect(useUnreadStore.getState().unreadTickets).toEqual([101])
    expect(useUnreadStore.getState().unreadCounts[101]).toBe(1)
  })
})
