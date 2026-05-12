import { beforeEach, describe, expect, it } from 'vitest'
import { useConversationStore } from '@/lib/stores/conversation-store'
import { HISTORY_CACHE_TTL_MS } from '@/lib/constants/conversation'

describe('conversation store', () => {
  beforeEach(() => {
    useConversationStore.setState({
      conversations: [],
      activeConversation: null,
      messages: [],
      isLoadingConversations: false,
      isLoadingMessages: false,
      isSendingMessage: false,
      currentUserId: null,
    })
  })

  it('clears persisted conversation state when switching users', () => {
    const store = useConversationStore.getState()
    store.resetForUser('user-a')
    store.addConversation({
      id: 'conv-1',
      customer_id: 'user-a',
      status: 'active',
      mode: 'ai',
      message_count: 0,
      started_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as any)

    store.resetForUser('user-b')

    expect(useConversationStore.getState().currentUserId).toBe('user-b')
    expect(useConversationStore.getState().conversations).toEqual([])
  })

  it('isolates history list cache by user id', () => {
    const store = useConversationStore.getState()
    store.setHistoryListCache('user-a', [{ id: 'a' } as any], null)
    store.setHistoryListCache('user-b', [{ id: 'b' } as any], null)

    expect(useConversationStore.getState().historyListCache['user-a'].items[0].id).toBe('a')
    expect(useConversationStore.getState().historyListCache['user-b'].items[0].id).toBe('b')
  })

  it('refreshes history list and message lastAccessAt when cache is read for display', async () => {
    const now = Date.now()
    useConversationStore.setState({
      ...useConversationStore.getState(),
      historyListCache: {
        'user-a': { items: [{ id: 'a' } as any], cursor: null, updatedAt: now - 1000, lastAccessAt: now - 1000 },
      },
      historyMessageCache: {
        'user-a:conv-1': { items: [{ id: 'm' } as any], cursor: null, updatedAt: now - 1000, lastAccessAt: now - 1000 },
      },
    })
    useConversationStore.getState().touchHistoryListCache('user-a')
    useConversationStore.getState().touchHistoryMessagesCache('user-a', 'conv-1')
    expect(useConversationStore.getState().historyListCache['user-a'].lastAccessAt).toBeGreaterThan(now - 1000)
    expect(useConversationStore.getState().historyMessageCache['user-a:conv-1'].lastAccessAt).toBeGreaterThan(now - 1000)
  })

  it('prunes expired history cache by TTL', () => {
    const now = Date.now()
    useConversationStore.setState({
      ...useConversationStore.getState(),
      historyListCache: {
        'user-a': { items: [{ id: 'a' } as any], cursor: null, updatedAt: now - HISTORY_CACHE_TTL_MS - 1 },
      },
      historyMessageCache: {
        'user-a:conv-1': { items: [{ id: 'm' } as any], cursor: null, updatedAt: now - HISTORY_CACHE_TTL_MS - 1, lastAccessAt: now - 1 },
      },
    })
    useConversationStore.getState().pruneExpiredCache()
    expect(useConversationStore.getState().historyListCache['user-a']).toBeUndefined()
    expect(useConversationStore.getState().historyMessageCache['user-a:conv-1']).toBeUndefined()
  })

  it('limits history message caches to most recent 10 conversations', () => {
    const store = useConversationStore.getState()
    const now = Date.now()
    const historyMessageCache: Record<string, any> = {}
    for (let i = 0; i < 12; i += 1) {
      historyMessageCache[`user-a:conv-${i}`] = {
        items: [{ id: `m-${i}` }],
        updatedAt: now,
        cursor: null,
        lastAccessAt: now + i,
      }
    }
    useConversationStore.setState({ ...store, historyMessageCache })
    useConversationStore.getState().enforceCacheLimits()
    expect(Object.keys(useConversationStore.getState().historyMessageCache)).toHaveLength(10)
  })
})
