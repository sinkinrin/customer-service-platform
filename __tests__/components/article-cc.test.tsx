import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArticleCard } from '@/components/ticket/article-content'
import type { TicketArticle } from '@/lib/hooks/use-ticket'

vi.mock('@/components/ui/media-renderer', () => ({ MediaRenderer: () => null }))
vi.mock('@/components/ui/image-lightbox', () => ({ ImageLightbox: () => null }))

const article: TicketArticle = {
  id: 10, ticket_id: 1, subject: 'Help', body: 'Mail body', content_type: 'text/plain',
  type: 'email', sender: 'Customer', internal: false, from: 'Customer <customer@example.com>',
  cc: 'Support <engineer@example.com>, Other <other@example.com>',
  created_at: '2026-09-08T00:00:00Z', created_by: 'Customer', attachments: [],
}

describe('Mail CC display', () => {
  it.each(['admin', 'staff'] as const)('shows original recipients for %s without interpreting names as HTML', (viewerRole) => {
    render(<ArticleCard article={{ ...article, cc: '<img src=x> <engineer@example.com>' }} viewerRole={viewerRole} />)
    expect(screen.getByText('ccLabel:')).toBeInTheDocument()
    expect(screen.getByText(/<img src=x> <engineer@example.com>/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
  it('shows the CC of each individual message, including system emails', () => {
    render(<><ArticleCard article={article} /><ArticleCard article={{ ...article, id: 11, sender: 'System', cc: 'second@example.com' }} /></>)
    expect(screen.getByText(/Support <engineer@example.com>, Other <other@example.com>/)).toBeInTheDocument()
    expect(screen.getByText(/second@example.com/)).toBeInTheDocument()
  })
  it.each([
    { viewerRole: 'customer' as const },
    { article: { ...article, cc: null } },
    { article: { ...article, cc: '  ' } },
    { article: { ...article, type: 'note' } },
    { showMeta: false },
  ])('hides CC outside staff email metadata: %j', (props) => {
    render(<ArticleCard article={article} {...props} />)
    expect(screen.queryByText('ccLabel:')).not.toBeInTheDocument()
  })
})
