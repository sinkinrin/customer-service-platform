import { describe, expect, it } from 'vitest'
import { getLastSyncStorageKey } from '@/lib/hooks/use-ticket-updates'

describe('ticket updates storage key', () => {
  it('namespaces the sync cursor by user id', () => {
    expect(getLastSyncStorageKey('user-a')).toBe('ticket-updates-last-sync:user-a')
    expect(getLastSyncStorageKey('user-b')).toBe('ticket-updates-last-sync:user-b')
  })

  it('uses an anonymous fallback when user id is missing', () => {
    expect(getLastSyncStorageKey()).toBe('ticket-updates-last-sync:anonymous')
  })
})
