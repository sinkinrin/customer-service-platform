import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationDetailPage from '@/app/customer/conversations/[id]/page'
import { AiConversationPage } from '@/components/conversation/ai-conversation-page'
import { getConversationMaterializedDraftKey } from '@/lib/constants/conversation'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockFetchHistoryConversations = vi.fn()
const mockFetchHistoryMessages = vi.fn()
const mockFetchConversationById = vi.fn()
const mockApplyRatingToCache = vi.fn()
const mockAppendHistoryMessageToCache = vi.fn()
const mockSendStreamingRequest = vi.fn()
const mockAbortStreamingRequest = vi.fn()
let streamingMode: 'success' | 'empty' | 'throw' | 'pending' = 'success'
let pendingStreamingPromise: Promise<string> | null = null
let resolvePendingStreaming: ((value: string) => void) | null = null
const mockHistoryReplaceState = vi.spyOn(window.history, 'replaceState')
const mockTouchHistoryListCache = vi.fn()
const mockTouchHistoryMessagesCache = vi.fn()
const mockStoreGetState = vi.fn(() => ({
  historyMessageCache: {},
  touchHistoryListCache: mockTouchHistoryListCache,
  touchHistoryMessagesCache: mockTouchHistoryMessagesCache,
}))
let currentSearchParams = new URLSearchParams('')
let currentConversationId = 'conv-1'
let currentUserId = 'user-1'
const stableRouter = { push: mockPush, replace: mockReplace }

const mockConversationHookState = {
  userId: 'user-1',
  historyListCache: {
    'user-1': {
      items: [{ id: 'conv-2', customer: { full_name: 'U2' }, created_at: '2025-01-01T00:00:00.000Z' }],
      updatedAt: Date.now(),
      cursor: 20,
    },
  } as any,
  historyMessageCache: {} as any,
}

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: currentConversationId }),
  useSearchParams: () => currentSearchParams,
  useRouter: () => stableRouter,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: currentUserId, email: 'u@test.com' } }),
}))

vi.mock('@/lib/hooks/use-conversation', () => ({
  useConversation: () => ({
    ...mockConversationHookState,
    fetchHistoryConversations: mockFetchHistoryConversations,
    fetchHistoryMessages: mockFetchHistoryMessages,
    fetchConversationById: mockFetchConversationById,
    applyRatingToCache: mockApplyRatingToCache,
    appendHistoryMessageToCache: mockAppendHistoryMessageToCache,
  }),
}))

vi.mock('@/lib/stores/conversation-store', () => ({
  useConversationStore: {
    getState: () => mockStoreGetState(),
  },
}))

vi.mock('@/hooks/use-streaming-chat', () => ({
  useStreamingChat: (options: any) => ({
    isLoading: false,
    isWaitingFirstToken: false,
    toolStatus: null,
    abort: mockAbortStreamingRequest,
    sendStreamingRequest: async (...args: any[]) => {
      mockSendStreamingRequest(...args)
      if (streamingMode === 'throw') {
        throw new Error('stream failed')
      }
      if (streamingMode === 'empty') {
        return ''
      }
      if (streamingMode === 'pending') {
        if (!pendingStreamingPromise) {
          pendingStreamingPromise = new Promise((resolve) => {
            resolvePendingStreaming = (value) => {
              const tempId = args[2] as string
              options?.onAddMessage?.(tempId, value)
              resolve(value)
            }
          })
        }
        return pendingStreamingPromise
      }
      const tempId = args[2] as string
      options?.onAddMessage?.(tempId, 'AI response')
      return 'AI response'
    },
  }),
}))

vi.mock('@/components/conversation/message-list', () => ({
  MessageList: ({ messages, renderMessageActions }: any) => (
    <div>
      <div data-testid="message-list">{messages.length}</div>
      {messages.map((message: any) => (
        <div key={message.id} data-testid={`msg-${message.id}`}>
          <span>{message.content}</span>
          {renderMessageActions ? renderMessageActions(message) : null}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/conversation/message-input', () => ({
  MessageInput: ({ onSend }: any) => <button onClick={() => onSend('hello from draft')} data-testid="message-input-send">send</button>,
}))

vi.mock('@/components/conversation/conversation-header', () => ({
  ConversationHeader: ({ onOpenHistory, onNewConversation }: any) => (
    <div>
      <button onClick={onOpenHistory}>open-history</button>
      <button onClick={onNewConversation} data-testid="header-new-conversation">new</button>
    </div>
  ),
}))

vi.mock('@/components/ai/feedback-dialog', () => ({
  FeedbackDialog: () => null,
}))

describe('Conversation detail history UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentSearchParams = new URLSearchParams('')
    currentConversationId = 'conv-1'
    currentUserId = 'user-1'
    mockConversationHookState.userId = 'user-1'
    sessionStorage.clear()
    mockConversationHookState.historyListCache = {
      'user-1': {
        items: [{ id: 'conv-2', customer: { full_name: 'U2' }, created_at: '2025-01-01T00:00:00.000Z' }],
        updatedAt: Date.now(),
        cursor: 20,
      },
    } as any
    mockStoreGetState.mockReturnValue({
      historyMessageCache: {},
      touchHistoryListCache: mockTouchHistoryListCache,
      touchHistoryMessagesCache: mockTouchHistoryMessagesCache,
    })
    mockApplyRatingToCache.mockReset()
    mockAppendHistoryMessageToCache.mockReset()
    mockSendStreamingRequest.mockReset()
    mockAbortStreamingRequest.mockReset()
    mockHistoryReplaceState.mockClear()
    streamingMode = 'success'
    pendingStreamingPromise = null
    resolvePendingStreaming = null
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))
    mockFetchHistoryMessages.mockResolvedValue({
      items: [{ id: 'm-1', metadata: { aiMode: true, role: 'customer' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
      pageItems: [{ id: 'm-1', metadata: { aiMode: true, role: 'customer' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
      hasMore: true,
      nextOffset: 50,
    })
    mockFetchConversationById.mockResolvedValue({ id: 'conv-1' })
    mockFetchHistoryConversations.mockResolvedValue({
      items: mockConversationHookState.historyListCache['user-1'].items,
      pageItems: mockConversationHookState.historyListCache['user-1'].items,
      hasMore: true,
      nextOffset: 20,
    })
  })

  it('uses full-screen dialog on mobile and supports history list load-more', async () => {
    const user = userEvent.setup()
    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    const dialog = document.querySelector('.h-\\[100vh\\]')
    expect(dialog).toBeTruthy()

    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenCalledWith(0)
    })

    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenCalledWith(20)
    })
  })

  it('supports history messages load-earlier pagination button', async () => {
    const user = userEvent.setup()
    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-1', 0, 50)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'loadMore' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-1', 50, 50)
    })
  })

  it('does not duplicate UI messages when same load-more page is triggered twice quickly', async () => {
    const mkMsg = (id: string) => ({ id, metadata: { aiMode: true, role: 'customer' }, content: id, created_at: '2025-01-01T00:00:00.000Z' })
    let resolveOlder: ((value: any) => void) | null = null
    const samePendingOlderPage = new Promise((resolve) => {
      resolveOlder = resolve
    })
    mockFetchHistoryMessages.mockImplementation((id: string, offset: number) => {
      if (id === 'conv-1' && offset === 0) {
        return Promise.resolve({
          items: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 1}`)),
          pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 1}`)),
          hasMore: true,
          nextOffset: 50,
        })
      }
      if (id === 'conv-1' && offset === 50) {
        return samePendingOlderPage
      }
      return Promise.resolve({
        items: [],
        pageItems: [],
        hasMore: false,
        nextOffset: 0,
      })
    })

    const user = userEvent.setup()
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('50')
    })

    const loadMore = screen.getByRole('button', { name: 'loadMore' })
    await user.click(loadMore)
    await user.click(loadMore)
    await act(async () => {
      resolveOlder?.({
        items: Array.from({ length: 100 }, (_, i) => mkMsg(`m-${i + 1}`)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 51}`)),
        hasMore: false,
        nextOffset: 100,
      })
      await samePendingOlderPage
    })

    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('100')
    })
  })

  it('shows cached messages immediately and does not block with full-screen loading during refresh', async () => {
    let resolveFetch: ((value: any) => void) | null = null
    mockFetchHistoryMessages.mockReturnValueOnce(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    mockStoreGetState.mockReturnValue({
      historyMessageCache: {
        'user-1:conv-1': {
          items: [{ id: 'c-1', metadata: { aiMode: true, role: 'customer' }, content: 'cached', created_at: '2025-01-01T00:00:00.000Z' }],
          updatedAt: Date.now(),
        },
      },
      touchHistoryListCache: mockTouchHistoryListCache,
      touchHistoryMessagesCache: mockTouchHistoryMessagesCache,
    })

    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('1')
    })
    expect(screen.queryByText('loadingText')).toBeNull()

    await act(async () => {
      resolveFetch?.({
        items: [{ id: 'm-1', metadata: { aiMode: true, role: 'customer' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'm-1', metadata: { aiMode: true, role: 'customer' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: false,
        nextOffset: 50,
      })
    })
  })

  it('keeps cached messages when background refresh fails', async () => {
    mockFetchHistoryMessages.mockRejectedValueOnce(new Error('refresh failed'))
    mockStoreGetState.mockReturnValue({
      historyMessageCache: {
        'user-1:conv-1': {
          items: [{ id: 'c-1', metadata: { aiMode: true, role: 'customer' }, content: 'cached', created_at: '2025-01-01T00:00:00.000Z' }],
          updatedAt: Date.now(),
        },
      },
      touchHistoryListCache: mockTouchHistoryListCache,
      touchHistoryMessagesCache: mockTouchHistoryMessagesCache,
    })

    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('1')
    })
    expect(screen.queryByText('loadingText')).toBeNull()
  })

  it('does not repeatedly re-fetch initial messages after cache refresh update', async () => {
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledTimes(1)
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockFetchHistoryMessages).toHaveBeenCalledTimes(1)
  })

  it('does not call mark-read on mount because read state is not persisted', async () => {
    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-1', 0, 50)
    })

    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/conversations/conv-1/mark-read',
      expect.anything()
    )
  })

  it('draft conversation does not fetch history or mark-read on open', async () => {
    currentConversationId = 'new'
    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByTestId('message-input-send')).toBeTruthy()
    })

    expect(mockFetchHistoryMessages).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/conversations/new/mark-read',
      expect.anything()
    )
  })

  it('draft conversation with materialized marker clears marker and navigates to real conversation', async () => {
    currentConversationId = 'new'
    sessionStorage.setItem(getConversationMaterializedDraftKey('user-1'), 'conv-real-on-mount')
    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-real-on-mount')
    })
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(mockFetchHistoryMessages).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/conversations/new/mark-read',
      expect.anything()
    )
  })

  it('does not send rating request to /new when switched to unmaterialized draft', async () => {
    const user = userEvent.setup()
    mockFetchHistoryMessages.mockResolvedValueOnce({
      items: [{ id: 'ai-1', metadata: { aiMode: true, role: 'ai' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
      pageItems: [{ id: 'ai-1', metadata: { aiMode: true, role: 'ai' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
      hasMore: false,
      nextOffset: 0,
    })

    currentConversationId = 'conv-1'
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByTitle('helpful')).toBeTruthy()
    })

    currentConversationId = 'new'
    rerender(<ConversationDetailPage />)
    const helpful = screen.queryByTitle('helpful')
    if (helpful) {
      await user.click(helpful)
    }

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations/new/messages/ai-1/rating'),
      expect.anything()
    )
  })

  it('first draft send materializes conversation then uses real id for stream/save/cache/rating', async () => {
    currentConversationId = 'new'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-1' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-1',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-1/messages' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'msg-ai-1',
              conversation_id: 'conv-real-1',
              sender_id: 'ai',
              sender_role: 'ai',
              content: 'AI response',
              message_type: 'text',
              metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:01.000Z',
              updated_at: '2026-05-12T00:00:01.000Z',
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-1/messages/msg-ai-1/rating' && init?.method === 'PUT') {
        return { ok: true, json: async () => ({ success: true }) } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/conversations', expect.objectContaining({ method: 'POST' }))
    })
    expect(mockHistoryReplaceState).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
    expect(mockSendStreamingRequest).toHaveBeenCalledWith(
      '/api/ai/chat',
      expect.objectContaining({ conversationId: 'conv-real-1' }),
      expect.any(String)
    )
    expect(mockAppendHistoryMessageToCache).toHaveBeenCalledWith('conv-real-1', expect.objectContaining({ id: 'msg-user-1' }))
    expect(mockAppendHistoryMessageToCache).toHaveBeenCalledWith('conv-real-1', expect.objectContaining({ id: 'msg-ai-1' }))

    await waitFor(() => {
      expect(screen.getByTitle('helpful')).toBeTruthy()
    })
    await user.click(screen.getByTitle('helpful'))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/conversations/conv-real-1/messages/msg-ai-1/rating',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(mockApplyRatingToCache).toHaveBeenCalledWith('conv-real-1', 'msg-ai-1', 'positive', null)
    expect(mockApplyRatingToCache).not.toHaveBeenCalledWith('new', expect.anything(), expect.anything(), expect.anything())
    expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-real-1')
  })

  it('staff draft send stays on the staff conversation route after materializing', async () => {
    currentConversationId = 'new'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'staff-conv-1' },
              message: {
                id: 'staff-msg-user-1',
                conversation_id: 'staff-conv-1',
                sender_id: 'staff-1',
                sender_role: 'staff',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'staff', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/staff-conv-1/messages' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'staff-msg-ai-1',
              conversation_id: 'staff-conv-1',
              sender_id: 'ai',
              sender_role: 'ai',
              content: 'AI response',
              message_type: 'text',
              metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:01.000Z',
              updated_at: '2026-05-12T00:00:01.000Z',
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<AiConversationPage basePath="/staff/conversations" humanMessageRole="staff" />)
    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/staff/conversations/staff-conv-1')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"role":"staff"'),
    }))
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/staff-conv-1')
  })

  it('streaming empty replaces route after stream ends, clears marker, and does not request /new/messages', async () => {
    currentConversationId = 'new'
    streamingMode = 'empty'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-empty' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-empty',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-real-empty')
    })
    expect(mockHistoryReplaceState).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  })

  it('materialization success + streaming pending does not replace URL and stores draft marker', async () => {
    currentConversationId = 'new'
    streamingMode = 'pending'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-pending' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-pending',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-pending/messages' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'msg-ai-1',
              conversation_id: 'conv-real-pending',
              sender_id: 'ai',
              sender_role: 'ai',
              content: 'AI response',
              message_type: 'text',
              metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:01.000Z',
              updated_at: '2026-05-12T00:00:01.000Z',
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(mockSendStreamingRequest).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ conversationId: 'conv-real-pending' }),
        expect.any(String)
      )
    })
    expect(mockHistoryReplaceState).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-pending')
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBe('conv-real-pending')

    await act(async () => {
      resolvePendingStreaming?.('AI response')
      await pendingStreamingPromise
    })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-real-pending')
    })
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  })

  it('does not replace old real id when user leaves draft during pending stream', async () => {
    currentConversationId = 'new'
    streamingMode = 'pending'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-pending-leave' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-pending-leave',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-pending-leave/messages' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'msg-ai-1',
              conversation_id: 'conv-real-pending-leave',
              sender_id: 'ai',
              sender_role: 'ai',
              content: 'AI response',
              message_type: 'text',
              metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:01.000Z',
              updated_at: '2026-05-12T00:00:01.000Z',
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { rerender } = render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(mockSendStreamingRequest).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ conversationId: 'conv-real-pending-leave' }),
        expect.any(String)
      )
    })

    currentConversationId = 'conv-2'
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-2', 0, 50)
    })

    await act(async () => {
      resolvePendingStreaming?.('AI response')
      await pendingStreamingPromise
    })

    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-pending-leave')
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBe('conv-real-pending-leave')
    expect(screen.queryByText('AI response')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  })

  it('aborts and invalidates pending draft stream before selecting a history conversation', async () => {
    currentConversationId = 'new'
    streamingMode = 'pending'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-history-select' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-history-select',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-history-select/messages' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'msg-ai-1',
              conversation_id: 'conv-real-history-select',
              sender_id: 'ai',
              sender_role: 'ai',
              content: 'AI response',
              message_type: 'text',
              metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:01.000Z',
              updated_at: '2026-05-12T00:00:01.000Z',
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(mockSendStreamingRequest).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ conversationId: 'conv-real-history-select' }),
        expect.any(String)
      )
    })

    mockAbortStreamingRequest.mockClear()
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.getByText('U2')).toBeTruthy()
    })
    await user.click(screen.getByText('U2'))

    expect(mockAbortStreamingRequest).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/customer/conversations/conv-2')

    await act(async () => {
      resolvePendingStreaming?.('AI response')
      await pendingStreamingPromise
    })

    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-history-select')
    expect(screen.queryByText('AI response')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/conv-real-history-select/messages', expect.anything())
  })

  it('does not replace old real id when user starts a new draft during pending stream', async () => {
    currentConversationId = 'new'
    streamingMode = 'pending'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-pending-new-click' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-pending-new-click',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-pending-new-click/messages' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'msg-ai-1',
              conversation_id: 'conv-real-pending-new-click',
              sender_id: 'ai',
              sender_role: 'ai',
              content: 'AI response',
              message_type: 'text',
              metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:01.000Z',
              updated_at: '2026-05-12T00:00:01.000Z',
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(mockSendStreamingRequest).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ conversationId: 'conv-real-pending-new-click' }),
        expect.any(String)
      )
    })
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBe('conv-real-pending-new-click')

    mockAbortStreamingRequest.mockClear()
    await user.click(screen.getByTestId('header-new-conversation'))
    expect(mockAbortStreamingRequest).toHaveBeenCalled()

    await act(async () => {
      resolvePendingStreaming?.('AI response')
      await pendingStreamingPromise
    })

    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-pending-new-click')
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(screen.queryByText('AI response')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  })

  it('does not update cache or UI when AI save returns after starting a new conversation', async () => {
    currentConversationId = 'new'
    const user = userEvent.setup()
    let resolveAiSave: ((value: any) => void) | null = null
    const aiSavePromise = new Promise<any>((resolve) => {
      resolveAiSave = resolve
    })
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-save-race' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-save-race',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-save-race/messages' && init?.method === 'POST') {
        return aiSavePromise as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/conversations/conv-real-save-race/messages', expect.objectContaining({ method: 'POST' }))
    })

    await user.click(screen.getByTestId('header-new-conversation'))

    await act(async () => {
      resolveAiSave?.({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'msg-ai-after-new',
            conversation_id: 'conv-real-save-race',
            sender_id: 'ai',
            sender_role: 'ai',
            content: 'AI response',
            message_type: 'text',
            metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
            created_at: '2026-05-12T00:00:01.000Z',
            updated_at: '2026-05-12T00:00:01.000Z',
          },
        }),
      })
      await aiSavePromise
    })

    expect(mockAppendHistoryMessageToCache).not.toHaveBeenCalledWith('conv-real-save-race', expect.objectContaining({ id: 'msg-ai-after-new' }))
    expect(screen.queryByText('AI response')).toBeNull()
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-save-race')
  })

  it('aborts and ignores pending stream when user changes on the same route', async () => {
    currentConversationId = 'new'
    streamingMode = 'pending'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-user-switch' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-user-switch',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-user-switch/messages' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true }) } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { rerender } = render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(mockSendStreamingRequest).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ conversationId: 'conv-real-user-switch' }),
        expect.any(String)
      )
    })

    mockAbortStreamingRequest.mockClear()
    currentUserId = 'user-2'
    mockConversationHookState.userId = 'user-2'
    rerender(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockAbortStreamingRequest).toHaveBeenCalled()
    })

    await act(async () => {
      resolvePendingStreaming?.('AI response')
      await pendingStreamingPromise
    })

    expect(screen.queryByText('AI response')).toBeNull()
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-user-switch')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/conv-real-user-switch/messages', expect.anything())
  })

  it('clears materialized draft id when user changes on the same draft route', async () => {
    currentConversationId = 'new'
    streamingMode = 'empty'
    const user = userEvent.setup()
    let materializeCount = 0
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        materializeCount += 1
        const conversationId = materializeCount === 1 ? 'conv-user-1-materialized' : 'conv-user-2-materialized'
        const senderId = materializeCount === 1 ? 'user-1' : 'user-2'
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: conversationId },
              message: {
                id: `msg-${senderId}`,
                conversation_id: conversationId,
                sender_id: senderId,
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { rerender } = render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-user-1-materialized')
    })

    currentUserId = 'user-2'
    mockConversationHookState.userId = 'user-2'
    mockReplace.mockClear()
    fetchMock.mockClear()
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByTestId('message-input-send')).toBeTruthy()
    })

    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/conversations', expect.objectContaining({ method: 'POST' }))
    })
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/conv-user-1-materialized/messages', expect.anything())
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-user-2-materialized')
    })
  })

  it('clears materialized draft marker when starting a new conversation from a real conversation page', async () => {
    currentConversationId = 'conv-2'
    sessionStorage.setItem(getConversationMaterializedDraftKey('user-1'), 'conv-old-pending')
    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByTestId('header-new-conversation')).toBeTruthy()
    })
    mockAbortStreamingRequest.mockClear()
    await userEvent.click(screen.getByTestId('header-new-conversation'))

    expect(mockAbortStreamingRequest).toHaveBeenCalled()
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-old-pending')
  })

  it('does not materialize current UI or start streaming when materialize returns after route switch', async () => {
    currentConversationId = 'new'
    const user = userEvent.setup()
    let resolveMaterialize: ((value: any) => void) | null = null
    const materializePromise = new Promise<any>((resolve) => {
      resolveMaterialize = resolve
    })
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return materializePromise
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { rerender } = render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/conversations', expect.objectContaining({ method: 'POST' }))
    })

    currentConversationId = 'conv-2'
    rerender(<ConversationDetailPage />)

    await act(async () => {
      resolveMaterialize?.({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            conversation: { id: 'conv-real-materialize-late' },
            message: {
              id: 'msg-user-1',
              conversation_id: 'conv-real-materialize-late',
              sender_id: 'user-1',
              sender_role: 'customer',
              content: 'hello from draft',
              message_type: 'text',
              metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:00.000Z',
              updated_at: '2026-05-12T00:00:00.000Z',
            },
          },
        }),
      } as any)
      await materializePromise
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockSendStreamingRequest).not.toHaveBeenCalled()
    expect(mockAppendHistoryMessageToCache).not.toHaveBeenCalledWith('conv-real-materialize-late', expect.anything())
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-materialize-late')
  })

  it('does not replace old real id after component unmounts during pending stream', async () => {
    currentConversationId = 'new'
    streamingMode = 'pending'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-pending-unmount' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-pending-unmount',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-pending-unmount/messages' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'msg-ai-1',
              conversation_id: 'conv-real-pending-unmount',
              sender_id: 'ai',
              sender_role: 'ai',
              content: 'AI response',
              message_type: 'text',
              metadata: { aiMode: true, role: 'ai', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:01.000Z',
              updated_at: '2026-05-12T00:00:01.000Z',
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { unmount } = render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))
    await waitFor(() => {
      expect(mockSendStreamingRequest).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ conversationId: 'conv-real-pending-unmount' }),
        expect.any(String)
      )
    })

    unmount()

    await act(async () => {
      resolvePendingStreaming?.('AI response')
      await pendingStreamingPromise
    })

    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-pending-unmount')
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBe('conv-real-pending-unmount')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  })

  it('streaming throw replaces route in catch, clears marker, and does not request /new/messages', async () => {
    currentConversationId = 'new'
    streamingMode = 'throw'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-throw' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-throw',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-real-throw')
    })
    expect(mockHistoryReplaceState).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  })

  it('keeps marker and does not replace route when AI response persistence fails', async () => {
    currentConversationId = 'new'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-ai-save-fail' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-ai-save-fail',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-ai-save-fail/messages' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: false }) } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(mockSendStreamingRequest).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({ conversationId: 'conv-real-ai-save-fail' }),
        expect.any(String)
      )
    })
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-real-ai-save-fail')
    expect(sessionStorage.getItem(getConversationMaterializedDraftKey('user-1'))).toBe('conv-real-ai-save-fail')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  })

  it('does not submit rating request for temporary AI message id', async () => {
    currentConversationId = 'new'
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url === '/api/conversations' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversation: { id: 'conv-real-temp-rating' },
              message: {
                id: 'msg-user-1',
                conversation_id: 'conv-real-temp-rating',
                sender_id: 'user-1',
                sender_role: 'customer',
                content: 'hello from draft',
                message_type: 'text',
                metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
                created_at: '2026-05-12T00:00:00.000Z',
                updated_at: '2026-05-12T00:00:00.000Z',
              },
            },
          }),
        } as any
      }
      if (url === '/api/conversations/conv-real-temp-rating/messages' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: false }) } as any
      }
      return { ok: true, json: async () => ({ success: true }) } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<ConversationDetailPage />)
    await user.click(screen.getByTestId('message-input-send'))

    await waitFor(() => {
      expect(screen.getByTitle('helpful')).toBeTruthy()
    })
    await user.click(screen.getByTitle('helpful'))

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/rating'),
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('does not display expired cached history messages', async () => {
    mockStoreGetState.mockReturnValue({
      historyMessageCache: {
        'user-1:conv-1': {
          items: [{ id: 'expired-1', metadata: { aiMode: true, role: 'customer' }, content: 'expired', created_at: '2025-01-01T00:00:00.000Z' }],
          updatedAt: Date.now() - (24 * 60 * 60 * 1000) - 1000,
        },
      },
      touchHistoryListCache: mockTouchHistoryListCache,
      touchHistoryMessagesCache: mockTouchHistoryMessagesCache,
    })

    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.queryByText('loadingText')).toBeTruthy()
    })
  })

  it('applies new=1 once only when id matches just-created marker without blocking on server validation', async () => {
    currentSearchParams = new URLSearchParams('new=1')
    sessionStorage.setItem('conversationJustCreated:user-1', 'conv-1')

    const { rerender } = render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockFetchHistoryMessages).not.toHaveBeenCalled()
    })
    expect(mockFetchConversationById).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('conversationJustCreated:user-1')).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-1')

    currentSearchParams = new URLSearchParams('')
    rerender(<ConversationDetailPage />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockFetchHistoryMessages).not.toHaveBeenCalled()
  })

  it('loads messages again when revisiting same conversation after one-time new=1 skip', async () => {
    currentConversationId = 'conv-a'
    currentSearchParams = new URLSearchParams('new=1')
    sessionStorage.setItem('conversationJustCreated:user-1', 'conv-a')

    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).not.toHaveBeenCalled()
    })

    currentConversationId = 'conv-b'
    currentSearchParams = new URLSearchParams('')
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-b', 0, 50)
    })

    currentConversationId = 'conv-a'
    currentSearchParams = new URLSearchParams('')
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-a', 0, 50)
    })
  })

  it('ignores new=1 for old conversation URL and still loads messages', async () => {
    currentSearchParams = new URLSearchParams('new=1')
    sessionStorage.setItem('conversationJustCreated:user-1', 'conv-other')

    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-1', 0, 50)
    })
    expect(mockReplace).not.toHaveBeenCalledWith('/customer/conversations/conv-1')
  })

  it('keeps earlier pages in UI when loading messages beyond 100 cache cap', async () => {
    const mkMsg = (id: string) => ({ id, metadata: { aiMode: true, role: 'customer' }, content: id, created_at: '2025-01-01T00:00:00.000Z' })
    mockFetchHistoryMessages
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 1}`)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 1}`)),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => mkMsg(`m-${i + 1}`)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 51}`)),
        hasMore: true,
        nextOffset: 100,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => mkMsg(`m-${i + 51}`)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 101}`)),
        hasMore: false,
        nextOffset: 150,
      })

    const user = userEvent.setup()
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('50')
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('100')
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('150')
    })
  })

  it('keeps history list pages in UI when loading beyond 50 cache cap', async () => {
    mockFetchHistoryConversations
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: false,
        nextOffset: 70,
      })

    const user = userEvent.setup()
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.getByText('U1')).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByText('U70')).toBeTruthy()
    })
  })

  it('does not overwrite loaded history UI list back to 50 when cache updates', async () => {
    mockFetchHistoryConversations
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: false,
        nextOffset: 70,
      })

    const user = userEvent.setup()
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByText('U70')).toBeTruthy()
    })

    mockConversationHookState.historyListCache = {
      'user-1': {
        items: Array.from({ length: 50 }, (_, i) => ({ id: `cache-${i + 1}`, customer: { full_name: `C${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        updatedAt: Date.now(),
        cursor: 50,
      },
    } as any
    rerender(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('U70')).toBeTruthy()
    })
  })

  it('does not shrink history UI list to 20 after offset=0 refresh', async () => {
    mockFetchHistoryConversations
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: false,
        nextOffset: 70,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: true,
        nextOffset: 20,
      })

    const user = userEvent.setup()
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByText('U70')).toBeTruthy()
    })

    // Trigger offset=0 refresh again while list already has 70 items.
    await user.click(screen.getByRole('button', { name: 'close' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.getByText('U70')).toBeTruthy()
    })
  })

  it('does not shrink 100+ displayed messages to 50 after initial offset=0 refresh', async () => {
    const mkMsg = (id: string) => ({ id, metadata: { aiMode: true, role: 'customer' }, content: id, created_at: '2025-01-01T00:00:00.000Z' })
    mockStoreGetState.mockReturnValue({
      historyMessageCache: {
        'user-1:conv-1': {
          items: Array.from({ length: 100 }, (_, i) => mkMsg(`cached-${i + 1}`)),
          updatedAt: Date.now(),
        },
      },
      touchHistoryListCache: mockTouchHistoryListCache,
      touchHistoryMessagesCache: mockTouchHistoryMessagesCache,
    })
    mockFetchHistoryMessages.mockResolvedValueOnce({
      items: Array.from({ length: 50 }, (_, i) => mkMsg(`cached-${i + 1}`)),
      pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`cached-${i + 1}`)),
      hasMore: true,
      nextOffset: 50,
    })

    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('100')
    })
  })

  it('keeps history offset after offset=0 refresh and next loadMore continues from 70', async () => {
    mockFetchHistoryConversations
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 50 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 51}`, customer: { full_name: `U${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: false,
        nextOffset: 70,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 20 }, (_, i) => ({ id: `conv-${i + 1}`, customer: { full_name: `U${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: true,
        nextOffset: 20,
      })
      .mockResolvedValueOnce({
        items: [],
        pageItems: [],
        hasMore: false,
        nextOffset: 70,
      })

    const user = userEvent.setup()
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByText('U70')).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'close' }))
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenNthCalledWith(3, 0)
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenNthCalledWith(4, 70)
    })
  })

  it('puts refreshed top items first on offset=0 while keeping list length and offset', async () => {
    mockConversationHookState.historyListCache = {
      'user-1': {
        items: [
          { id: 'old-1', customer: { full_name: 'Old 1' }, created_at: '2025-01-01T00:00:00.000Z' },
          ...Array.from({ length: 49 }, (_, i) => ({ id: `old-${i + 2}`, customer: { full_name: `Old ${i + 2}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        ],
        updatedAt: Date.now(),
        cursor: 70,
      },
    } as any
    mockFetchHistoryConversations
      .mockResolvedValueOnce({
        items: [
          { id: 'new-1', customer: { full_name: 'New 1' }, created_at: '2025-01-01T00:00:00.000Z' },
          { id: 'old-1', customer: { full_name: 'Old 1 Updated' }, created_at: '2025-01-01T00:00:00.000Z' },
        ],
        pageItems: [
          { id: 'new-1', customer: { full_name: 'New 1' }, created_at: '2025-01-01T00:00:00.000Z' },
          { id: 'old-1', customer: { full_name: 'Old 1 Updated' }, created_at: '2025-01-01T00:00:00.000Z' },
        ],
        hasMore: true,
        nextOffset: 20,
      })
      .mockResolvedValueOnce({
        items: [],
        pageItems: [],
        hasMore: false,
        nextOffset: 70,
      })

    const user = userEvent.setup()
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('New 1')
    expect(screen.getByText('Old 50')).toBeTruthy()
    expect(screen.getByText('Old 1 Updated')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenNthCalledWith(2, 70)
    })
  })

  it('keeps message offset after offset=0 refresh and next loadMore continues from current offset', async () => {
    const mkMsg = (id: string, day: number) => ({
      id,
      metadata: { aiMode: true, role: 'customer' },
      content: id,
      created_at: `2025-01-${String(day).padStart(2, '0')}T00:00:00.000Z`,
    })
    mockFetchHistoryMessages
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 1}`, i + 1)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 1}`, i + 1)),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => mkMsg(`m-${i + 1}`, i + 1)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 51}`, i + 51)),
        hasMore: true,
        nextOffset: 100,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 51}`, i + 51)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 51}`, i + 51)),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 150 }, (_, i) => mkMsg(`m-${i + 1}`, i + 1)),
        pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`m-${i + 101}`, i + 101)),
        hasMore: false,
        nextOffset: 150,
      })

    const user = userEvent.setup()
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('50')
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('100')
    })

    currentSearchParams = new URLSearchParams('refresh=1')
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenNthCalledWith(3, 'conv-1', 0, 50)
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenNthCalledWith(4, 'conv-1', 100, 50)
    })
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('150')
    })
  })

  it('clears history panel loaded list and offset when switching user on same route', async () => {
    mockFetchHistoryConversations
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({ id: `u1-conv-${i + 1}`, customer: { full_name: `U1-${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 50 }, (_, i) => ({ id: `u1-conv-${i + 1}`, customer: { full_name: `U1-${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: true,
        nextOffset: 50,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, i) => ({ id: `u1-conv-${i + 51}`, customer: { full_name: `U1-${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        pageItems: Array.from({ length: 20 }, (_, i) => ({ id: `u1-conv-${i + 51}`, customer: { full_name: `U1-${i + 51}` }, created_at: '2025-01-01T00:00:00.000Z' })),
        hasMore: false,
        nextOffset: 70,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'u2-conv-1', customer: { full_name: 'U2-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'u2-conv-1', customer: { full_name: 'U2-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: true,
        nextOffset: 20,
      })
      .mockResolvedValueOnce({
        items: [],
        pageItems: [],
        hasMore: false,
        nextOffset: 20,
      })

    const user = userEvent.setup()
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(screen.getByText('U1-70')).toBeTruthy()
    })

    currentUserId = 'user-2'
    mockConversationHookState.userId = 'user-2'
    mockConversationHookState.historyListCache = {
      'user-2': {
        items: [{ id: 'u2-cache-1', customer: { full_name: 'U2-cache-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        updatedAt: Date.now(),
        cursor: 20,
      },
    } as any
    rerender(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.queryByText('U1-70')).toBeNull()
      expect(screen.getByText('U2-1')).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenNthCalledWith(4, 20)
    })
  })

  it('clears message list when switching user on same route', async () => {
    mockFetchHistoryMessages.mockImplementation(async () => {
      if (currentUserId === 'user-1') {
        return {
          items: [{ id: 'u1-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u1', created_at: '2025-01-01T00:00:00.000Z' }],
          pageItems: [{ id: 'u1-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u1', created_at: '2025-01-01T00:00:00.000Z' }],
          hasMore: false,
          nextOffset: 0,
        }
      }
      return {
        items: [],
        pageItems: [],
        hasMore: false,
        nextOffset: 0,
      }
    })

    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('1')
    })

    currentUserId = 'user-2'
    mockConversationHookState.userId = 'user-2'
    rerender(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('0')
    })
  })

  it('does not reuse previous conversation offset when switching conversation for same user', async () => {
    const mkMsg = (id: string) => ({ id, metadata: { aiMode: true, role: 'customer' }, content: id, created_at: '2025-01-01T00:00:00.000Z' })
    mockFetchHistoryMessages.mockImplementation(async (id: string, offset: number) => {
      if (id === 'conv-1' && offset === 0) {
        return { items: Array.from({ length: 50 }, (_, i) => mkMsg(`a-${i + 1}`)), pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`a-${i + 1}`)), hasMore: true, nextOffset: 50 }
      }
      if (id === 'conv-1' && offset === 50) {
        return { items: Array.from({ length: 100 }, (_, i) => mkMsg(`a-${i + 1}`)), pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`a-${i + 51}`)), hasMore: true, nextOffset: 100 }
      }
      if (id === 'conv-2' && offset === 0) {
        return { items: Array.from({ length: 50 }, (_, i) => mkMsg(`b-${i + 1}`)), pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`b-${i + 1}`)), hasMore: true, nextOffset: 50 }
      }
      return { items: Array.from({ length: 100 }, (_, i) => mkMsg(`b-${i + 1}`)), pageItems: Array.from({ length: 50 }, (_, i) => mkMsg(`b-${i + 51}`)), hasMore: false, nextOffset: 100 }
    })

    const user = userEvent.setup()
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('50')
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-1', 50, 50)
    })

    currentConversationId = 'conv-2'
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-2', 0, 50)
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-2', 50, 50)
    })
  })

  it('keeps loaded history list visible when background refresh fails', async () => {
    mockConversationHookState.historyListCache = {
      'user-1': {
        items: [{ id: 'conv-cache-1', customer: { full_name: 'Cache 1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        updatedAt: Date.now(),
        cursor: 20,
      },
    } as any
    mockFetchHistoryConversations.mockRejectedValueOnce(new Error('history refresh failed'))

    const user = userEvent.setup()
    render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.getByText('Cache 1')).toBeTruthy()
      expect(screen.getByText('history refresh failed')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'retry' })).toBeTruthy()
    })
  })

  it('ignores stale async results from previous user context', async () => {
    let resolveU1OlderMessages: ((value: any) => void) | null = null
    let resolveU1History: ((value: any) => void) | null = null
    const u1OlderMessagesPromise = new Promise((resolve) => { resolveU1OlderMessages = resolve })
    const u1HistoryPromise = new Promise((resolve) => { resolveU1History = resolve })
    mockFetchHistoryMessages.mockImplementation((id: string, offset: number) => {
      if (currentUserId === 'user-1' && id === 'conv-1' && offset === 0) {
        return Promise.resolve({
          items: [{ id: 'u1-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u1', created_at: '2025-01-01T00:00:00.000Z' }],
          pageItems: [{ id: 'u1-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u1', created_at: '2025-01-01T00:00:00.000Z' }],
          hasMore: true,
          nextOffset: 50,
        })
      }
      if (currentUserId === 'user-1' && id === 'conv-1' && offset === 50) return u1OlderMessagesPromise
      return Promise.resolve({
        items: [{ id: 'u2-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u2', created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'u2-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u2', created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: false,
        nextOffset: 0,
      })
    })
    mockFetchHistoryConversations.mockImplementation(() => {
      if (currentUserId === 'user-1') return u1HistoryPromise
      return Promise.resolve({
        items: [{ id: 'u2-conv-1', customer: { full_name: 'U2-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'u2-conv-1', customer: { full_name: 'U2-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: false,
        nextOffset: 20,
      })
    })

    const user = userEvent.setup()
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await user.click(screen.getByRole('button', { name: 'open-history' }))

    currentUserId = 'user-2'
    mockConversationHookState.userId = 'user-2'
    mockConversationHookState.historyListCache = {
      'user-2': { items: [], updatedAt: Date.now(), cursor: 0 },
    } as any
    rerender(<ConversationDetailPage />)

    await act(async () => {
      resolveU1OlderMessages?.({
        items: [{ id: 'u1-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u1', created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'u1-msg-1', metadata: { aiMode: true, role: 'customer' }, content: 'u1', created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: false,
        nextOffset: 50,
      })
      resolveU1History?.({
        items: [{ id: 'u1-conv-1', customer: { full_name: 'U1-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'u1-conv-1', customer: { full_name: 'U1-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: false,
        nextOffset: 20,
      })
      await Promise.all([u1OlderMessagesPromise, u1HistoryPromise])
    })

    await waitFor(() => {
      expect(screen.getByTestId('message-list')).toHaveTextContent('1')
      expect(screen.queryByText('U1-1')).toBeNull()
    })
  })

  it('ignores stale pending history from previous conversation for same user', async () => {
    currentUserId = 'user-1'
    mockConversationHookState.userId = 'user-1'
    currentConversationId = 'conv-a'
    mockConversationHookState.historyListCache = {
      'user-1': {
        items: [{ id: 'cache-a-1', customer: { full_name: 'Cache A1' }, created_at: '2025-01-01T00:00:00.000Z' }],
        updatedAt: Date.now(),
        cursor: 20,
      },
    } as any

    let resolveAOlderHistory: ((value: any) => void) | null = null
    const aOlderHistoryPromise = new Promise((resolve) => { resolveAOlderHistory = resolve })
    mockFetchHistoryConversations.mockImplementation((offset: number) => {
      if (currentConversationId === 'conv-a' && offset === 0) {
        return Promise.resolve({
          items: [{ id: 'a-1', customer: { full_name: 'A1' }, created_at: '2025-01-01T00:00:00.000Z' }],
          pageItems: [{ id: 'a-1', customer: { full_name: 'A1' }, created_at: '2025-01-01T00:00:00.000Z' }],
          hasMore: true,
          nextOffset: 20,
        })
      }
      if (currentConversationId === 'conv-a' && offset === 20) return aOlderHistoryPromise
      if (currentConversationId === 'conv-b' && offset === 0) {
        return Promise.resolve({
          items: [{ id: 'b-1', customer: { full_name: 'B1' }, created_at: '2025-01-01T00:00:00.000Z' }],
          pageItems: [{ id: 'b-1', customer: { full_name: 'B1' }, created_at: '2025-01-01T00:00:00.000Z' }],
          hasMore: true,
          nextOffset: 20,
        })
      }
      if (currentConversationId === 'conv-b' && offset === 20) {
        return Promise.resolve({
          items: [],
          pageItems: [],
          hasMore: false,
          nextOffset: 20,
        })
      }
      return Promise.resolve({ items: [], pageItems: [], hasMore: false, nextOffset: 0 })
    })

    const user = userEvent.setup()
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await user.click(screen.getByRole('button', { name: 'close' }))

    currentConversationId = 'conv-b'
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.getByText('B1')).toBeTruthy()
      expect(screen.queryByText('A-old')).toBeNull()
    })

    await act(async () => {
      resolveAOlderHistory?.({
        items: [{ id: 'a-old', customer: { full_name: 'A-old' }, created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'a-old', customer: { full_name: 'A-old' }, created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: false,
        nextOffset: 40,
      })
      await aOlderHistoryPromise
    })

    await waitFor(() => {
      expect(screen.getByText('B1')).toBeTruthy()
      expect(screen.queryByText('A-old')).toBeNull()
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenCalledWith(20)
    })
  })

  it('resets history panel state on conversation switch and starts from new conversation offset', async () => {
    currentUserId = 'user-1'
    mockConversationHookState.userId = 'user-1'
    currentConversationId = 'conv-a'

    let rejectAHistory: ((reason?: any) => void) | null = null
    const aHistoryPromise = new Promise((_, reject) => { rejectAHistory = reject })
    mockFetchHistoryConversations.mockImplementation((offset: number) => {
      if (currentConversationId === 'conv-a' && offset === 0) {
        return Promise.resolve({
          items: Array.from({ length: 50 }, (_, i) => ({ id: `a-${i + 1}`, customer: { full_name: `A-${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
          pageItems: Array.from({ length: 50 }, (_, i) => ({ id: `a-${i + 1}`, customer: { full_name: `A-${i + 1}` }, created_at: '2025-01-01T00:00:00.000Z' })),
          hasMore: true,
          nextOffset: 50,
        })
      }
      if (currentConversationId === 'conv-a' && offset === 50) return aHistoryPromise
      if (currentConversationId === 'conv-b' && offset === 0) {
        return Promise.resolve({
          items: [{ id: 'b-1', customer: { full_name: 'B-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
          pageItems: [{ id: 'b-1', customer: { full_name: 'B-1' }, created_at: '2025-01-01T00:00:00.000Z' }],
          hasMore: true,
          nextOffset: 20,
        })
      }
      if (currentConversationId === 'conv-b' && offset === 20) {
        return Promise.resolve({
          items: [],
          pageItems: [],
          hasMore: false,
          nextOffset: 20,
        })
      }
      return Promise.resolve({ items: [], pageItems: [], hasMore: false, nextOffset: 0 })
    })

    const user = userEvent.setup()
    const { rerender } = render(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await user.click(screen.getByRole('button', { name: 'close' }))

    // move to conv-b while conv-a has pending history request
    currentConversationId = 'conv-b'
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.getByText('B-1')).toBeTruthy()
      expect(screen.queryByText('A-1')).toBeNull()
      expect(screen.queryByText('Failed to load history')).toBeNull()
    })
    await user.click(screen.getByRole('button', { name: 'loadMore' }))
    await waitFor(() => {
      expect(mockFetchHistoryConversations).toHaveBeenCalledWith(20)
      expect(mockFetchHistoryConversations).not.toHaveBeenCalledWith(70)
    })

    await act(async () => {
      rejectAHistory?.(new Error('late failure'))
      await aHistoryPromise.catch(() => undefined)
    })
    await waitFor(() => {
      expect(screen.queryByText('late failure')).toBeNull()
      expect(screen.getByText('B-1')).toBeTruthy()
    })
  })

  it('selecting history conversation only navigates and does not prefetch messages even if prefetch would fail', async () => {
    const user = userEvent.setup()
    mockFetchHistoryMessages.mockImplementation(async (id: string) => {
      if (id === 'conv-2') throw new Error('prefetch failed')
      return {
        items: [{ id: 'm-1', metadata: { aiMode: true, role: 'customer' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
        pageItems: [{ id: 'm-1', metadata: { aiMode: true, role: 'customer' }, content: 'hello', created_at: '2025-01-01T00:00:00.000Z' }],
        hasMore: true,
        nextOffset: 50,
      }
    })
    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'open-history' })).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: 'open-history' }))
    await waitFor(() => {
      expect(screen.getByText('U2')).toBeTruthy()
    })
    await user.click(screen.getByText('U2'))

    expect(mockPush).toHaveBeenCalledWith('/customer/conversations/conv-2')
    expect(mockFetchHistoryMessages).toHaveBeenCalledTimes(1)
    expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-1', 0, 50)
  })
})
