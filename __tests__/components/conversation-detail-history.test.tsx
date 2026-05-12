import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationDetailPage from '@/app/customer/conversations/[id]/page'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockFetchHistoryConversations = vi.fn()
const mockFetchHistoryMessages = vi.fn()
const mockFetchConversationById = vi.fn()
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
    applyRatingToCache: vi.fn(),
    appendHistoryMessageToCache: vi.fn(),
  }),
}))

vi.mock('@/lib/stores/conversation-store', () => ({
  useConversationStore: {
    getState: () => mockStoreGetState(),
  },
}))

vi.mock('@/hooks/use-streaming-chat', () => ({
  useStreamingChat: () => ({
    isLoading: false,
    isWaitingFirstToken: false,
    toolStatus: null,
    sendStreamingRequest: vi.fn(),
  }),
}))

vi.mock('@/components/conversation/message-list', () => ({
  MessageList: ({ messages }: any) => <div data-testid="message-list">{messages.length}</div>,
}))

vi.mock('@/components/conversation/message-input', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}))

vi.mock('@/components/conversation/conversation-header', () => ({
  ConversationHeader: ({ onOpenHistory }: any) => <button onClick={onOpenHistory}>open-history</button>,
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

  it('applies new=1 once only when id matches just-created marker and removes marker from URL', async () => {
    currentSearchParams = new URLSearchParams('new=1')
    sessionStorage.setItem('conversationJustCreated:user-1', 'conv-1')

    const { rerender } = render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockFetchHistoryMessages).not.toHaveBeenCalled()
    })
    expect(mockFetchConversationById).toHaveBeenCalledWith('conv-1')
    expect(sessionStorage.getItem('conversationJustCreated:user-1')).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-1')

    currentSearchParams = new URLSearchParams('')
    rerender(<ConversationDetailPage />)
    await waitFor(() => {
      expect(mockFetchHistoryMessages).toHaveBeenCalledWith('conv-1', 0, 50)
    })
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

  it('does not skip load when new=1 marker matches but server validation fails', async () => {
    currentSearchParams = new URLSearchParams('new=1')
    sessionStorage.setItem('conversationJustCreated:user-1', 'conv-1')
    mockFetchConversationById.mockRejectedValueOnce(new Error('not found'))

    render(<ConversationDetailPage />)

    await waitFor(() => {
      expect(mockFetchConversationById).toHaveBeenCalledWith('conv-1')
    })
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
