/**
 * Utils tests for real exported helpers.
 */

import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('class1', 'class2')
    expect(result).toContain('class1')
    expect(result).toContain('class2')
  })

  it('handles conditional class names', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')
    expect(result).toContain('active')
  })

  it('ignores falsy values', () => {
    const result = cn('base', false, null, undefined, '')
    expect(result).toBe('base')
  })

  it('resolves Tailwind class conflicts', () => {
    const result = cn('p-4', 'p-8')
    expect(result).toContain('p-8')
  })

  it('handles empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })
})
