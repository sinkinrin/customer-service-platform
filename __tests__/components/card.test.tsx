import { fireEvent, render, screen } from '@testing-library/react'
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
})
