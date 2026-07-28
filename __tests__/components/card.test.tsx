import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Card } from '@/components/ui/card'

describe('Card accessibility', () => {
  it('makes clickable cards keyboard operable', () => {
    const onClick = vi.fn()
    render(<Card onClick={onClick}>Open destination</Card>)

    const card = screen.getByRole('button', { name: 'Open destination' })
    expect(card).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })

    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('does not mark passive cards as buttons', () => {
    render(<Card>Static content</Card>)

    expect(screen.queryByRole('button', { name: 'Static content' })).not.toBeInTheDocument()
  })

  it('keeps interactive-only styling without inventing clickable semantics', () => {
    render(<Card interactive>Highlighted content</Card>)

    const card = screen.getByText('Highlighted content')
    expect(card).toHaveClass('cursor-pointer')
    expect(card).not.toHaveAttribute('role')
    expect(card).not.toHaveAttribute('tabindex')
    expect(screen.queryByRole('button', { name: 'Highlighted content' })).not.toBeInTheDocument()
  })

  it('does not synthesize an event handler for passive server-rendered cards', () => {
    const renderCard = (Card as unknown as {
      render: (
        props: { children: ReactNode },
        ref: null
      ) => ReactElement<{ onKeyDown?: unknown }>
    }).render

    const cardElement = renderCard({ children: 'Static content' }, null)

    expect(cardElement.props.onKeyDown).toBeUndefined()
  })
})
