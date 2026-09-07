import type { AnchorHTMLAttributes } from 'react'
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TicketHistoryDialog } from '@/components/admin/ticket-history-dialog'

vi.mock('next/link', () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

afterEach(() => vi.unstubAllGlobals())

describe('ticket history navigation', () => {
  it.each(['/admin/tickets', '/staff/tickets'])('makes the entire card a native link to %s', async (ticketBasePath) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tickets: [{
        id: 42, number: 64042, title: 'Previous support request',
        state: 'open', priority: 'normal', created_at: '2026-09-01T00:00:00Z',
      }] } }),
    }))
    render(<TicketHistoryDialog open onOpenChange={vi.fn()} userId="customer-1"
      userName="Customer" userEmail="customer@example.com" ticketBasePath={ticketBasePath} />)
    const title = await screen.findByText('Previous support request')
    const link = title.closest('a')!
    expect(link).toHaveAttribute('href', `${ticketBasePath}/42`)
    expect(within(link).getByText('#64042')).toBeInTheDocument()
    expect(within(link).getByText('open')).toBeInTheDocument()
    expect(within(link).queryByRole('button')).not.toBeInTheDocument()
  })
})
