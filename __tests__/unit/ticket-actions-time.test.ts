import { describe, expect, it } from 'vitest'
import { formatDateTimeLocalValue } from '@/components/ticket/ticket-actions'

describe('ticket actions time formatting', () => {
  it('formats datetime-local values in local time instead of UTC slices', () => {
    const date = new Date(2026, 3, 21, 9, 5)

    expect(formatDateTimeLocalValue(date)).toBe('2026-04-21T09:05')
  })
})
