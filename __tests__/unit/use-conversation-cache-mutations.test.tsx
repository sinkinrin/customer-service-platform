import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConversation } from '@/lib/hooks/use-conversation'
import { useConversationStore } from '@/lib/stores/conversation-store'

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

function seedState() {
  useConversationStore.setState({
    ...useConversationStore.getState(),
    currentUserId: 'user-1',
    historyListCache: {
      'user-1': { items: [{ id: 'conv-1' } as any], updatedAt: Date.now(), cursor: null },
    },
    historyMessageCache: {
      'user-1:conv-1': {
        items: [{
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender_id: 'user-1',
          content: 'hello',
          message_type: 'text',
          created_at: new Date().toISOString(),
        }],
        updatedAt: Date.now(),
        cursor: null,
        lastAccessAt: Date.now(),
      },
    },
    conversations: [],
    activeConversation: null,
    messages: [],
    isLoadingConversations: false,
    isLoadingMessages: false,
    isSendingMessage: false,
  } as any)
}

describe('useConversation cache mutation matrix', () => {
  beforeEach(() => {
    seedState()
    vi.clearAllMocks()
  })

  it('create invalidates history list cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'conv-2', customer_id: 'user-1', status: 'active', mode: 'ai', message_count: 0, started_at: '', created_at: '', updated_at: '' } }),
    }))
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.createConversation()
    })
    expect(useConversationStore.getState().historyListCache['user-1']).toBeUndefined()
  })

  it('close/delete invalidate list and conversation message cache', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.closeConversation('conv-1')
    })
    expect(useConversationStore.getState().historyListCache['user-1']).toBeUndefined()
    expect(useConversationStore.getState().historyMessageCache['user-1:conv-1']).toBeUndefined()

    act(() => {
      useConversationStore.getState().setHistoryMessagesCache('user-1', 'conv-1', [{
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        content: 'hello',
        message_type: 'text',
        created_at: new Date().toISOString(),
      } as any], null)
      useConversationStore.getState().setHistoryListCache('user-1', [{ id: 'conv-1' } as any], null)
    })

    await act(async () => {
      await result.current.deleteConversation('conv-1')
    })
    expect(useConversationStore.getState().historyListCache['user-1']).toBeUndefined()
    expect(useConversationStore.getState().historyMessageCache['user-1:conv-1']).toBeUndefined()
  })

  it('add message and rating update message cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'msg-2',
          conversation_id: 'conv-1',
          sender_id: 'user-1',
          content: 'new',
          message_type: 'text',
          created_at: new Date().toISOString(),
        },
      }),
    }))
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('conv-1', 'new')
    })
    expect(useConversationStore.getState().historyMessageCache['user-1:conv-1'].items.some((item) => item.id === 'msg-2')).toBe(true)

    act(() => {
      result.current.applyRatingToCache('conv-1', 'msg-2', 'positive', null)
    })
    const rated = useConversationStore.getState().historyMessageCache['user-1:conv-1'].items.find((item) => item.id === 'msg-2')
    expect(rated?.rating?.rating).toBe('positive')
  })

  it('keeps fetchHistoryMessages callback stable when history cache changes', () => {
    const { result, rerender } = renderHook(() => useConversation())
    const before = result.current.fetchHistoryMessages

    act(() => {
      useConversationStore.getState().setHistoryMessagesCache('user-1', 'conv-2', [{
        id: 'msg-3',
        conversation_id: 'conv-2',
        sender_id: 'user-1',
        content: 'new cache',
        message_type: 'text',
        created_at: new Date().toISOString(),
      } as any], null)
    })

    rerender()
    expect(result.current.fetchHistoryMessages).toBe(before)
  })

  it('dedupes concurrent history list requests for same userId + page params', async () => {
    let resolveFetch: ((value: any) => void) | null = null
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useConversation())
    let p1: Promise<any>
    let p2: Promise<any>
    await act(async () => {
      p1 = result.current.fetchHistoryConversations(0, 20)
      p2 = result.current.fetchHistoryConversations(0, 20)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch?.({
        ok: true,
        json: async () => ({ data: [{ id: 'conv-1' }] }),
      })
      await Promise.all([p1!, p2!])
    })
  })

  it('dedupes concurrent history message requests for same userId + conversationId + page params', async () => {
    let resolveFetch: ((value: any) => void) | null = null
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useConversation())
    let p1: Promise<any>
    let p2: Promise<any>
    await act(async () => {
      p1 = result.current.fetchHistoryMessages('conv-1', 0, 50)
      p2 = result.current.fetchHistoryMessages('conv-1', 0, 50)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch?.({
        ok: true,
        json: async () => ({ data: { messages: [] } }),
      })
      await Promise.all([p1!, p2!])
    })
  })

  it('refreshes lastAccessAt when reading usable list/message cache during fetch merge', async () => {
    const now = Date.now()
    useConversationStore.setState({
      ...useConversationStore.getState(),
      historyListCache: {
        'user-1': { items: [{ id: 'conv-1' } as any], updatedAt: now, cursor: null, lastAccessAt: now - 10_000 },
      },
      historyMessageCache: {
        'user-1:conv-1': {
          items: [{
            id: 'msg-1',
            conversation_id: 'conv-1',
            sender_id: 'user-1',
            content: 'hello',
            message_type: 'text',
            created_at: new Date().toISOString(),
          } as any],
          updatedAt: now,
          cursor: null,
          lastAccessAt: now - 10_000,
        },
      },
    } as any)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { conversations: [{ id: 'conv-2' }] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { messages: [{ id: 'msg-2', conversation_id: 'conv-1', sender_id: 'user-1', content: 'n', message_type: 'text', created_at: new Date().toISOString() }] } }) }))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.fetchHistoryConversations(20, 20)
      await result.current.fetchHistoryMessages('conv-1', 50, 50)
    })

    expect(useConversationStore.getState().historyListCache['user-1'].lastAccessAt).toBeGreaterThan(now - 10_000)
    expect(useConversationStore.getState().historyMessageCache['user-1:conv-1'].lastAccessAt).toBeGreaterThan(now - 10_000)
  })

  it('returns merged earlier page beyond cache cap while keeping cache limited to 100', async () => {
    const nowIso = new Date().toISOString()
    const cachedItems = Array.from({ length: 100 }, (_, index) => ({
      id: `cached-${index + 1}`,
      conversation_id: 'conv-1',
      sender_id: 'user-1',
      content: `cached-${index + 1}`,
      message_type: 'text',
      created_at: nowIso,
    }))
    useConversationStore.setState({
      ...useConversationStore.getState(),
      historyMessageCache: {
        'user-1:conv-1': {
          items: cachedItems as any,
          updatedAt: Date.now(),
          cursor: 100,
          lastAccessAt: Date.now(),
        },
      },
    } as any)

    const fetchedOlder = Array.from({ length: 50 }, (_, index) => ({
      id: `older-${index + 1}`,
      conversation_id: 'conv-1',
      sender_id: 'user-1',
      content: `older-${index + 1}`,
      message_type: 'text',
      created_at: nowIso,
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { messages: fetchedOlder.reverse() } }),
    }))

    const { result } = renderHook(() => useConversation())
    let merged: Awaited<ReturnType<typeof result.current.fetchHistoryMessages>>
    await act(async () => {
      merged = await result.current.fetchHistoryMessages('conv-1', 100, 50)
    })

    expect(merged!.items.some((item) => item.id === 'older-1')).toBe(true)
    expect(merged!.items.length).toBe(150)
    expect(useConversationStore.getState().historyMessageCache['user-1:conv-1'].items.length).toBe(100)
    expect(useConversationStore.getState().historyMessageCache['user-1:conv-1'].items.some((item) => item.id === 'older-1')).toBe(false)
  })

  it('returns merged history list beyond cache cap while keeping cache limited to 50', async () => {
    useConversationStore.setState({
      ...useConversationStore.getState(),
      historyListCache: {
        'user-1': {
          items: Array.from({ length: 50 }, (_, i) => ({ id: `cached-${i + 1}` } as any)),
          updatedAt: Date.now(),
          cursor: 50,
          lastAccessAt: Date.now(),
        },
      },
    } as any)

    const fetchedOlder = Array.from({ length: 20 }, (_, i) => ({ id: `older-${i + 1}` }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { conversations: fetchedOlder } }),
    }))

    const { result } = renderHook(() => useConversation())
    let merged: Awaited<ReturnType<typeof result.current.fetchHistoryConversations>>
    await act(async () => {
      merged = await result.current.fetchHistoryConversations(50, 20)
    })

    expect(merged!.items.some((item) => item.id === 'cached-1')).toBe(true)
    expect(merged!.items.some((item) => item.id === 'older-1')).toBe(true)
    expect(merged!.items.length).toBe(70)
    expect(useConversationStore.getState().historyListCache['user-1'].items.length).toBe(50)
    expect(useConversationStore.getState().historyListCache['user-1'].items.some((item) => item.id === 'older-1')).toBe(false)
  })

  it('keeps history list cursor from rolling back on offset=0 refresh', async () => {
    useConversationStore.setState({
      ...useConversationStore.getState(),
      historyListCache: {
        'user-1': {
          items: Array.from({ length: 50 }, (_, i) => ({ id: `cached-${i + 1}` } as any)),
          updatedAt: Date.now(),
          cursor: 70,
          lastAccessAt: Date.now(),
        },
      },
    } as any)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { conversations: Array.from({ length: 20 }, (_, i) => ({ id: `fresh-${i + 1}` })) } }),
    }))

    const { result } = renderHook(() => useConversation())
    let refreshed: Awaited<ReturnType<typeof result.current.fetchHistoryConversations>>
    await act(async () => {
      refreshed = await result.current.fetchHistoryConversations(0, 20)
    })

    expect(refreshed!.nextOffset).toBe(70)
    expect(useConversationStore.getState().historyListCache['user-1'].cursor).toBe(70)
  })

  it('keeps history message cursor from rolling back on offset=0 refresh', async () => {
    const nowIso = new Date().toISOString()
    useConversationStore.setState({
      ...useConversationStore.getState(),
      historyMessageCache: {
        'user-1:conv-1': {
          items: Array.from({ length: 100 }, (_, i) => ({
            id: `cached-${i + 1}`,
            conversation_id: 'conv-1',
            sender_id: 'user-1',
            content: `cached-${i + 1}`,
            message_type: 'text',
            created_at: nowIso,
          })) as any,
          updatedAt: Date.now(),
          cursor: 100,
          lastAccessAt: Date.now(),
        },
      },
    } as any)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { messages: Array.from({ length: 50 }, (_, i) => ({
        id: `fresh-${i + 1}`,
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        content: `fresh-${i + 1}`,
        message_type: 'text',
        created_at: nowIso,
      })) } }),
    }))

    const { result } = renderHook(() => useConversation())
    let refreshed: Awaited<ReturnType<typeof result.current.fetchHistoryMessages>>
    await act(async () => {
      refreshed = await result.current.fetchHistoryMessages('conv-1', 0, 50)
    })

    expect(refreshed!.nextOffset).toBe(100)
    expect(useConversationStore.getState().historyMessageCache['user-1:conv-1'].cursor).toBe(100)
  })
})
