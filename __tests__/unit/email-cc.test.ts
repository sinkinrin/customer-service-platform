import { describe, expect, it } from 'vitest'
import { parseCcAddresses } from '@/lib/ticket/email-cc'

describe('CC mailbox parsing', () => {
  it('handles names, quoted commas, semicolons, whitespace and repeated addresses', () => {
    expect(parseCcAddresses('"王工, 技术" <TECH@example.com>, Other <other@example.com>; tech@example.com'))
      .toEqual(['tech@example.com', 'other@example.com'])
  })
  it('ignores email-looking display names', () => {
    expect(parseCcAddresses('"tech@example.com" <external@example.com>')).toEqual(['external@example.com'])
    expect(parseCcAddresses('"tech@example.com"')).toEqual([])
  })
  it.each([
    'Support: first@example.com, second@example.com;',
    'first@example.com, Support: second@example.com;',
    'first@example.com, second@example.com (Support)',
    'first@example.com, not a mailbox',
    'Tech (Support) <tech@example.com>',
    'first@example.com, Tech (Support) <tech@example.com>',
    ', tech@example.com',
    'tech@example.com,,other@example.com',
    'tech@example.com,',
  ])('falls back for the entire list when a recipient format is unsupported: %s', (value) => {
    expect(parseCcAddresses(value)).toEqual([])
  })
  it('allows colons in quoted display names without treating them as address groups', () => {
    expect(parseCcAddresses('"Support: APAC" <tech@example.com>')).toEqual(['tech@example.com'])
    expect(parseCcAddresses('"Tech (Support)" <tech@example.com>')).toEqual(['tech@example.com'])
  })
  it.each([null, undefined, '', '  ', 'not an email', 'Tech <tech@example.com', '"Tech <tech@example.com>'])
    ('does not guess mailboxes from missing or malformed input: %s', (value) => {
      expect(parseCcAddresses(value)).toEqual([])
    })
})
