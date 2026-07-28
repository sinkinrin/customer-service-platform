import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
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

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: mocks.user }),
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
  AlertDialogAction: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import { TicketReopenButton } from '@/components/ticket/ticket-reopen-button'

describe('TicketReopenButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = {
      id: 'customer-1',
      email: 'customer@example.com',
      role: 'customer',
      full_name: 'Customer One',
      zammad_id: 101,
      region: 'region-a',
      group_ids: [2],
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a warning instead of full success when the audit note is partial', async () => {
    const onSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 207,
      json: async () => ({
        success: true,
        data: {
          state: 'open',
          outcome: 'partial',
          auditNote: 'unconfirmed',
        },
      }),
    } as Response))

    render(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.warning).toHaveBeenCalledWith('partialSuccess'))
    expect(mocks.success).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers)
      .get('X-CSP-Expected-User-Id')).toBe('customer-1')
  })

  it('warns and refreshes when the reopen outcome is unconfirmed', async () => {
    const onSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: {
          code: 'OUTCOME_UNCONFIRMED',
          message: 'Outcome unconfirmed',
        },
      }),
    } as Response))

    render(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.warning).toHaveBeenCalledWith('outcomeUnconfirmed'))
    expect(mocks.error).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('treats a rejected PUT transport as an unconfirmed outcome', async () => {
    const onSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection reset')))

    render(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.warning).toHaveBeenCalledWith('outcomeUnconfirmed'))
    expect(mocks.error).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('treats an invalid or empty 5xx response body as an unconfirmed outcome', async () => {
    const onSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    } as Response))

    render(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.warning).toHaveBeenCalledWith('outcomeUnconfirmed'))
    expect(mocks.error).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('treats an invalid 4xx response body as a definite failure', async () => {
    const onSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    } as Response))

    render(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('error'))
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('drops a pending response after the ticket id changes', async () => {
    const response = deferred<Response>()
    const previousOnSuccess = vi.fn()
    const currentOnSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))

    const view = render(
      <TicketReopenButton ticketId={1} onSuccess={previousOnSuccess} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal

    view.rerender(
      <TicketReopenButton ticketId={2} onSuccess={currentOnSuccess} />
    )
    expect(signal?.aborted).toBe(true)

    await act(async () => {
      response.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { auditNote: 'created' } }),
      } as Response)
      await response.promise
      await Promise.resolve()
    })

    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(previousOnSuccess).not.toHaveBeenCalled()
    expect(currentOnSuccess).not.toHaveBeenCalled()
  })

  it('drops a pending response when only the authorization context changes', async () => {
    const response = deferred<Response>()
    const onSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))

    const view = render(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal

    mocks.user = {
      ...mocks.user,
      region: 'region-b',
      group_ids: [3],
    }
    view.rerender(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    expect(signal?.aborted).toBe(true)

    await act(async () => {
      response.resolve({
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          error: { code: 'OUTCOME_UNCONFIRMED' },
        }),
      } as Response)
      await response.promise
      await Promise.resolve()
    })

    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('drops a pending response after unmount', async () => {
    const response = deferred<Response>()
    const onSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))

    const view = render(<TicketReopenButton ticketId={1} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal

    view.unmount()
    expect(signal?.aborted).toBe(true)

    await act(async () => {
      response.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { auditNote: 'created' } }),
      } as Response)
      await response.promise
      await Promise.resolve()
    })

    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
