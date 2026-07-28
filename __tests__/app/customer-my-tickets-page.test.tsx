import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  user: {
    id: 'customer-1',
    email: 'customer@example.com',
    role: 'customer',
    zammad_id: 101,
  },
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: authState.user }),
}))

import MyTicketsPage from '@/app/customer/my-tickets/page'

describe('customer my tickets page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.user = {
      id: 'customer-1',
      email: 'customer@example.com',
      role: 'customer',
      zammad_id: 101,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          tickets: [
            {
              id: 42,
              number: '202607280001',
              title: 'Accessible ticket row',
              state_id: 1,
              priority_id: 2,
              article_count: 3,
              created_at: '2026-07-28T01:00:00.000Z',
              updated_at: '2026-07-28T02:00:00.000Z',
            },
          ],
          hasMore: false,
        },
      }),
    }) as typeof fetch)
  })

  it('keeps native table row semantics and exposes a keyboard-reachable link', async () => {
    render(<MyTicketsPage />)

    await waitFor(() => {
      expect(screen.getByText('Accessible ticket row')).toBeInTheDocument()
    })

    const ticketRow = screen.getByText('Accessible ticket row').closest('tr')
    expect(ticketRow).not.toBeNull()
    expect(ticketRow).not.toHaveAttribute('role', 'button')
    expect(ticketRow).not.toHaveAttribute('tabindex')

    const viewLink = within(ticketRow!).getByRole('link', {
      name: 'table.view #202607280001: Accessible ticket row',
    })
    expect(within(ticketRow!).queryByRole('button')).not.toBeInTheDocument()
    expect(viewLink).toHaveAttribute('href', '/customer/my-tickets/42')
  })

  it('refreshes page one when the realtime provider dispatches a ticket update', async () => {
    let requestCount = 0
    vi.mocked(fetch).mockImplementation(() => {
      requestCount += 1
      const refreshed = requestCount > 1

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            tickets: [{
              id: 42,
              number: '202607280001',
              title: refreshed ? 'Refreshed ticket row' : 'Initial ticket row',
              state_id: refreshed ? 2 : 1,
              priority_id: 2,
              article_count: refreshed ? 4 : 3,
              created_at: '2026-07-28T01:00:00.000Z',
              updated_at: refreshed
                ? '2026-07-28T03:00:00.000Z'
                : '2026-07-28T02:00:00.000Z',
            }],
            hasMore: false,
          },
        }),
      } as Response)
    })

    render(<MyTicketsPage />)
    await screen.findByText('Initial ticket row')

    act(() => {
      window.dispatchEvent(new CustomEvent('ticket-update', {
        detail: { ticketId: 42, event: 'article_created' },
      }))
    })

    await screen.findByText('Refreshed ticket row')
    expect(screen.queryByText('Initial ticket row')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [input] of vi.mocked(fetch).mock.calls) {
      expect(String(input)).toContain('limit=50&page=1')
    }
  })

  it('clears the previous customer tickets as soon as identity changes', async () => {
    let resolveNextCustomer!: (response: Response) => void
    const nextCustomerResponse = new Promise<Response>((resolve) => {
      resolveNextCustomer = resolve
    })

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('next%40example.com')) {
        return nextCustomerResponse
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            tickets: [{
              id: 1,
              number: 'OLD-1',
              title: 'Previous customer ticket',
              state_id: 1,
              priority_id: 2,
              article_count: 1,
              created_at: '2026-07-28T01:00:00.000Z',
              updated_at: '2026-07-28T02:00:00.000Z',
            }],
            hasMore: true,
          },
        }),
      } as Response)
    })

    const view = render(<MyTicketsPage />)
    await screen.findByText('Previous customer ticket')
    const searchInput = screen.getByPlaceholderText('searchPlaceholder')
    fireEvent.change(searchInput, { target: { value: 'OLD-1' } })
    expect(searchInput).toHaveValue('OLD-1')

    authState.user = {
      id: 'customer-2',
      email: 'next@example.com',
      role: 'customer',
      zammad_id: 202,
    }
    view.rerender(<MyTicketsPage />)

    expect(screen.queryByText('Previous customer ticket')).not.toBeInTheDocument()
    expect(screen.queryByText('table.loadMore')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('searchPlaceholder')).toHaveValue('')

    await act(async () => {
      resolveNextCustomer({
        ok: true,
        json: async () => ({ data: { tickets: [], hasMore: false } }),
      } as Response)
      await nextCustomerResponse
    })
  })

  it('ignores a stale response that resolves after the next customer request', async () => {
    let resolvePreviousCustomer!: (response: Response) => void
    const previousCustomerResponse = new Promise<Response>((resolve) => {
      resolvePreviousCustomer = resolve
    })

    let requestCount = 0
    vi.mocked(fetch).mockImplementation(() => {
      requestCount += 1
      if (requestCount === 1) {
        return previousCustomerResponse
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            tickets: [{
              id: 2,
              number: 'NEW-2',
              title: 'Current customer ticket',
              state_id: 1,
              priority_id: 2,
              article_count: 2,
              created_at: '2026-07-28T03:00:00.000Z',
              updated_at: '2026-07-28T04:00:00.000Z',
            }],
            hasMore: false,
          },
        }),
      } as Response)
    })

    const view = render(<MyTicketsPage />)
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    const previousSignal = vi.mocked(fetch).mock.calls[0][1]?.signal

    authState.user = {
      id: 'customer-2',
      email: 'customer@example.com',
      role: 'customer',
      zammad_id: 202,
    }
    view.rerender(<MyTicketsPage />)

    await screen.findByText('Current customer ticket')
    expect(previousSignal?.aborted).toBe(true)

    await act(async () => {
      resolvePreviousCustomer({
        ok: true,
        json: async () => ({
          data: {
            tickets: [{
              id: 3,
              number: 'STALE-3',
              title: 'Stale previous customer ticket',
              state_id: 1,
              priority_id: 2,
              article_count: 3,
              created_at: '2026-07-28T05:00:00.000Z',
              updated_at: '2026-07-28T06:00:00.000Z',
            }],
            hasMore: false,
          },
        }),
      } as Response)
      await previousCustomerResponse
    })

    expect(screen.getByText('Current customer ticket')).toBeInTheDocument()
    expect(screen.queryByText('Stale previous customer ticket')).not.toBeInTheDocument()
  })

  it('clears tickets when the authorization identity changes under the same email', async () => {
    let resolveNextIdentity!: (response: Response) => void
    const nextIdentityResponse = new Promise<Response>((resolve) => {
      resolveNextIdentity = resolve
    })
    let requestCount = 0

    vi.mocked(fetch).mockImplementation(() => {
      requestCount += 1
      if (requestCount > 1) {
        return nextIdentityResponse
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            tickets: [{
              id: 4,
              number: 'SAME-EMAIL-OLD',
              title: 'Previous authorization ticket',
              state_id: 1,
              priority_id: 2,
              article_count: 1,
              created_at: '2026-07-28T01:00:00.000Z',
              updated_at: '2026-07-28T02:00:00.000Z',
            }],
            hasMore: true,
          },
        }),
      } as Response)
    })

    const view = render(<MyTicketsPage />)
    await screen.findByText('Previous authorization ticket')
    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: 'SAME-EMAIL-OLD' },
    })

    authState.user = {
      id: 'customer-2',
      email: 'customer@example.com',
      role: 'customer',
      zammad_id: 202,
    }
    view.rerender(<MyTicketsPage />)

    expect(screen.queryByText('Previous authorization ticket')).not.toBeInTheDocument()
    expect(screen.queryByText('table.loadMore')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('searchPlaceholder')).toHaveValue('')
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))

    await act(async () => {
      resolveNextIdentity({
        ok: true,
        json: async () => ({ data: { tickets: [], hasMore: false } }),
      } as Response)
      await nextIdentityResponse
    })
  })
})
