import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/ui/empty-state'
import { Inbox } from 'lucide-react'

describe('EmptyState', () => {
  it('renders title correctly', () => {
    render(<EmptyState title="No items found" />)

    expect(screen.getByText('No items found')).toBeInTheDocument()
  })

  it('renders title and description', () => {
    render(
      <EmptyState
        title="No tickets"
        description="You have no open tickets"
      />
    )

    expect(screen.getByText('No tickets')).toBeInTheDocument()
    expect(screen.getByText('You have no open tickets')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Empty inbox"
      />
    )

    // The icon should be rendered within the component
    expect(screen.getByText('Empty inbox')).toBeInTheDocument()
    // Icon renders as SVG
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('calls action onClick when button clicked', () => {
    const handleClick = vi.fn()

    render(
      <EmptyState
        title="No results"
        action={{ label: 'Create New', onClick: handleClick }}
      />
    )

    const button = screen.getByRole('button', { name: 'Create New' })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    render(
      <EmptyState
        title="Test"
        className="custom-class"
        data-testid="empty-state"
      />
    )

    const element = screen.getByTestId('empty-state')
    expect(element).toHaveClass('custom-class')
  })

  it('does not render action button when action is not provided', () => {
    render(<EmptyState title="No action" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    render(<EmptyState title="Title only" />)

    // Check that only the title heading is present
    expect(screen.getByText('Title only')).toBeInTheDocument()
    // No paragraph element for description should exist
    const title = screen.getByText('Title only')
    expect(title.nextElementSibling).toBeNull()
  })
})
