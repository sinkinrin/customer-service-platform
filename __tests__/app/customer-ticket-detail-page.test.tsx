import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const authState = vi.hoisted(() => ({
  user: {
    id: 'customer-1',
    email: 'customer@example.com',
    role: 'customer' as const,
    full_name: 'Customer One',
    zammad_id: 101,
    region: 'region-a',
    group_ids: [2],
  },
}))

const routeState = vi.hoisted(() => ({ id: '1' }))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  markAsRead: vi.fn(),
  markTicketNotificationsAsRead: vi.fn().mockResolvedValue(undefined),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => routeState,
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: authState.user }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
  },
}))

vi.mock('@/lib/stores/unread-store', () => ({
  useUnreadStore: () => ({ markAsRead: mocks.markAsRead }),
}))

vi.mock('@/lib/hooks/use-notifications', () => ({
  useNotifications: () => ({
    markTicketNotificationsAsRead: mocks.markTicketNotificationsAsRead,
  }),
}))

vi.mock('@/lib/hooks/use-file-upload', async () => {
  const React = await import('react')

  return {
    useFileUpload: () => {
      const [uploadedFiles, setUploadedFiles] = React.useState<Array<{
        localId: string
        file: File
        attachmentId: number | null
        uploading: boolean
      }>>([])

      return {
        uploadedFiles,
        isUploading: false,
        addFiles: async (files: FileList | File[]) => {
          setUploadedFiles(Array.from(files).map((file, index) => ({
            localId: `file-${index}`,
            file,
            attachmentId: index + 1,
            uploading: false,
          })))
        },
        removeFile: (index: number) => {
          setUploadedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
        },
        clearFiles: () => setUploadedFiles([]),
        getFormId: async () => null,
      }
    },
  }
})

vi.mock('@/lib/hooks/use-drag-drop', () => ({
  useDragDrop: () => ({ isDragging: false, dragProps: {} }),
}))

vi.mock('@/components/ticket/article-content', () => ({
  ArticleCard: ({ article }: { article: { body: string } }) => <div>{article.body}</div>,
}))

vi.mock('@/components/ticket/ticket-rating', () => ({
  TicketRating: () => <div>ticket-rating</div>,
}))

vi.mock('@/components/ticket/ticket-reopen-button', () => ({
  TicketReopenButton: () => <button>reopen-ticket</button>,
}))

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: () => <nav>breadcrumb</nav>,
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

import CustomerTicketDetailPage from '@/app/customer/my-tickets/[id]/page'

function ticketResponse(title: string, state = 'open'): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {
        ticket: {
          id: 1,
          number: '10001',
          title,
          state,
          state_id: state === 'closed' ? 4 : 2,
          priority_id: 2,
          owner_id: 55,
          owner_name: 'Agent',
          created_at: '2026-07-28T01:00:00.000Z',
          updated_at: '2026-07-28T02:00:00.000Z',
        },
      },
    }),
  } as Response
}

function articlesResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {
        articles: body
          ? [{ id: 1, ticket_id: 1, body }]
          : [],
      },
    }),
  } as Response
}

function ticketUpdateEvent() {
  return new CustomEvent('ticket-update', {
    detail: {
      ticketId: 1,
      event: 'status_changed',
      data: {},
    },
  })
}

describe('customer ticket detail identity lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.user = {
      id: 'customer-1',
      email: 'customer@example.com',
      role: 'customer',
      full_name: 'Customer One',
      zammad_id: 101,
      region: 'region-a',
      group_ids: [2],
    }
    routeState.id = '1'
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hides the old ticket, draft, and uploads immediately when authorization changes', async () => {
    const staleTicket = deferred<Response>()
    const staleArticles = deferred<Response>()
    const replacementTicket = deferred<Response>()
    const replacementArticles = deferred<Response>()
    let phase: 'initial' | 'stale-refresh' | 'replacement' = 'initial'

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const isArticles = String(input).endsWith('/articles')
      if (phase === 'initial') {
        return Promise.resolve(isArticles
          ? articlesResponse('Old article')
          : ticketResponse('Old identity ticket'))
      }
      if (phase === 'stale-refresh') {
        return isArticles ? staleArticles.promise : staleTicket.promise
      }
      return isArticles ? replacementArticles.promise : replacementTicket.promise
    }) as typeof fetch)

    const view = render(<CustomerTicketDetailPage />)
    await screen.findAllByText('Old identity ticket')
    await screen.findByText('Old article')

    const reply = screen.getAllByPlaceholderText('replyPlaceholder')[0]
    fireEvent.change(reply, { target: { value: 'Old private draft' } })
    const file = new File(['secret'], 'old-secret.txt', { type: 'text/plain' })
    fireEvent.change(document.getElementById('reply-files-mobile')!, {
      target: { files: [file] },
    })
    await screen.findAllByText('old-secret.txt')

    phase = 'stale-refresh'
    act(() => window.dispatchEvent(ticketUpdateEvent()))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
    const staleTicketSignal = vi.mocked(fetch).mock.calls[2][1]?.signal
    const staleArticlesSignal = vi.mocked(fetch).mock.calls[3][1]?.signal

    phase = 'replacement'
    authState.user = {
      ...authState.user,
      region: 'region-b',
      group_ids: [3],
    }
    view.rerender(<CustomerTicketDetailPage />)

    expect(screen.queryAllByText('Old identity ticket')).toHaveLength(0)
    expect(screen.queryByText('Old article')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Old private draft')).not.toBeInTheDocument()
    expect(screen.queryByText('old-secret.txt')).not.toBeInTheDocument()
    expect(staleTicketSignal?.aborted).toBe(true)
    expect(staleArticlesSignal?.aborted).toBe(true)

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(6))
    await act(async () => {
      replacementTicket.resolve(ticketResponse('Replacement identity ticket'))
      replacementArticles.resolve(articlesResponse('Replacement article'))
      await Promise.all([replacementTicket.promise, replacementArticles.promise])
    })
    await screen.findAllByText('Replacement identity ticket')
    await screen.findByText('Replacement article')

    await act(async () => {
      staleTicket.resolve(ticketResponse('Late stale ticket'))
      staleArticles.resolve(articlesResponse('Late stale article'))
      await Promise.all([staleTicket.promise, staleArticles.promise])
      await Promise.resolve()
    })

    expect(screen.getAllByText('Replacement identity ticket').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Late stale ticket')).toHaveLength(0)
    expect(screen.queryByText('Late stale article')).not.toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('keeps the newest realtime refresh when an older request resolves last', async () => {
    const firstTicket = deferred<Response>()
    const firstArticles = deferred<Response>()
    const secondTicket = deferred<Response>()
    const secondArticles = deferred<Response>()
    let requestCount = 0

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const isArticles = String(input).endsWith('/articles')
      requestCount += 1
      if (requestCount <= 2) {
        return Promise.resolve(isArticles
          ? articlesResponse('Initial article')
          : ticketResponse('Initial ticket'))
      }
      if (requestCount <= 4) {
        return isArticles ? firstArticles.promise : firstTicket.promise
      }
      return isArticles ? secondArticles.promise : secondTicket.promise
    }) as typeof fetch)

    render(<CustomerTicketDetailPage />)
    await screen.findAllByText('Initial ticket')

    act(() => window.dispatchEvent(ticketUpdateEvent()))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
    const firstTicketSignal = vi.mocked(fetch).mock.calls[2][1]?.signal
    const firstArticlesSignal = vi.mocked(fetch).mock.calls[3][1]?.signal

    act(() => window.dispatchEvent(ticketUpdateEvent()))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(6))
    expect(firstTicketSignal?.aborted).toBe(true)
    expect(firstArticlesSignal?.aborted).toBe(true)

    await act(async () => {
      secondTicket.resolve(ticketResponse('Newest ticket'))
      secondArticles.resolve(articlesResponse('Newest article'))
      await Promise.all([secondTicket.promise, secondArticles.promise])
    })
    await screen.findAllByText('Newest ticket')
    await screen.findByText('Newest article')

    await act(async () => {
      firstTicket.resolve(ticketResponse('Older late ticket'))
      firstArticles.resolve(articlesResponse('Older late article'))
      await Promise.all([firstTicket.promise, firstArticles.promise])
      await Promise.resolve()
    })

    expect(screen.getAllByText('Newest ticket').length).toBeGreaterThan(0)
    expect(screen.getByText('Newest article')).toBeInTheDocument()
    expect(screen.queryAllByText('Older late ticket')).toHaveLength(0)
    expect(screen.queryByText('Older late article')).not.toBeInTheDocument()
  })

  it('suppresses a close response after the authorization lifecycle changes', async () => {
    const closeResponse = deferred<Response>()
    let closeStarted = false

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        closeStarted = true
        return closeResponse.promise
      }

      const isArticles = String(input).endsWith('/articles')
      return Promise.resolve(isArticles
        ? articlesResponse('Current article')
        : ticketResponse(closeStarted ? 'Replacement ticket' : 'Current ticket'))
    }) as typeof fetch)

    const view = render(<CustomerTicketDetailPage />)
    await screen.findAllByText('Current ticket')
    fireEvent.click(screen.getByRole('button', { name: 'closeDialog.confirm' }))
    await waitFor(() => expect(closeStarted).toBe(true))
    const closeCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')

    authState.user = {
      ...authState.user,
      zammad_id: 202,
    }
    view.rerender(<CustomerTicketDetailPage />)
    expect(closeCall?.[1]?.signal?.aborted).toBe(true)

    await act(async () => {
      closeResponse.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response)
      await closeResponse.promise
      await Promise.resolve()
    })

    await screen.findAllByText('Replacement ticket')
    expect(mocks.success).not.toHaveBeenCalledWith('closeSuccess')
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('suppresses a reply response after the ticket lifecycle changes', async () => {
    const replyResponse = deferred<Response>()

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return replyResponse.promise
      }

      const isArticles = String(input).endsWith('/articles')
      return Promise.resolve(isArticles
        ? articlesResponse('Current article')
        : ticketResponse(routeState.id === '1' ? 'Ticket one' : 'Ticket two'))
    }) as typeof fetch)

    const view = render(<CustomerTicketDetailPage />)
    await screen.findAllByText('Ticket one')
    fireEvent.change(screen.getAllByPlaceholderText('replyPlaceholder')[0], {
      target: { value: 'Reply for ticket one' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'sendReply' }))
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true)
    })
    const replyCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')

    routeState.id = '2'
    view.rerender(<CustomerTicketDetailPage />)
    expect(replyCall?.[1]?.signal?.aborted).toBe(true)

    await act(async () => {
      replyResponse.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response)
      await replyResponse.promise
      await Promise.resolve()
    })

    await screen.findAllByText('Ticket two')
    expect(screen.queryByDisplayValue('Reply for ticket one')).not.toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalledWith('replySent')
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
