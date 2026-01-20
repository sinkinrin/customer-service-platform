import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Home, Ticket } from 'lucide-react'

// Mock next/link to render as a simple anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('Breadcrumb', () => {
  it('renders all items with correct labels', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Tickets', href: '/tickets' },
          { label: 'Ticket #123' },
        ]}
      />
    )

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Tickets')).toBeInTheDocument()
    expect(screen.getByText('Ticket #123')).toBeInTheDocument()
  })

  it('renders links for items with href', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Tickets', href: '/tickets' },
          { label: 'Current Page' },
        ]}
      />
    )

    const homeLink = screen.getByRole('link', { name: 'Home' })
    const ticketsLink = screen.getByRole('link', { name: 'Tickets' })

    expect(homeLink).toHaveAttribute('href', '/')
    expect(ticketsLink).toHaveAttribute('href', '/tickets')
  })

  it('marks last item as current page', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Current Page' },
        ]}
      />
    )

    // The aria-current is on the parent span wrapper, not the text span itself
    const textSpan = screen.getByText('Current Page')
    const parentSpan = textSpan.parentElement
    expect(parentSpan).toHaveAttribute('aria-current', 'page')
  })

  it('renders separator between items', () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Tickets', href: '/tickets' },
          { label: 'Detail' },
        ]}
      />
    )

    // ChevronRight icons are used as separators
    const separators = container.querySelectorAll('svg.lucide-chevron-right')
    // There should be 2 separators for 3 items
    expect(separators.length).toBe(2)
  })

  it('renders icon when provided', () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/', icon: Home },
          { label: 'Tickets', href: '/tickets', icon: Ticket },
        ]}
      />
    )

    // Should have Home and Ticket icons plus ChevronRight separator
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })

  it('applies custom className', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }]}
        className="custom-breadcrumb"
      />
    )

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('custom-breadcrumb')
  })

  it('has proper aria-label for accessibility', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }]}
      />
    )

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toBeInTheDocument()
  })

  it('handles single item correctly', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Only Item' }]}
      />
    )

    expect(screen.getByText('Only Item')).toBeInTheDocument()
    // The aria-current is on the parent span wrapper
    const textSpan = screen.getByText('Only Item')
    const parentSpan = textSpan.parentElement
    expect(parentSpan).toHaveAttribute('aria-current', 'page')
  })
})
