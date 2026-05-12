import { describe, expect, it, vi } from 'vitest'
import {
  buildFallbackStateForQuota,
  createConversationStorageAdapter,
  pruneHistoryCachesForLimits,
} from '@/lib/stores/conversation-store'

describe('conversation-store quota handling', () => {
  it('buildFallbackStateForQuota trims history payload shape safely', () => {
    const largeMessages = Array.from({ length: 120 }, (_, index) => ({
      id: `m-${index}`,
      content: 'x'.repeat(5000),
      created_at: new Date().toISOString(),
      sender_id: 'u',
      message_type: 'text',
      conversation_id: 'c',
    }))

    const serialized = JSON.stringify({
      state: {
        currentUserId: 'user-1',
        conversations: [],
        historyListCache: {
          'user-1': { items: [], updatedAt: Date.now(), cursor: null },
        },
        historyMessageCache: {
          'user-1:conv-1': {
            items: largeMessages,
            updatedAt: Date.now(),
            cursor: null,
            lastAccessAt: Date.now(),
          },
        },
      },
    })

    const fallback = buildFallbackStateForQuota(serialized)
    expect(typeof fallback).toBe('string')
    expect(() => JSON.parse(fallback)).not.toThrow()
  })

  it('swallows repeated quota errors to avoid breaking runtime flow', () => {
    const setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    const adapter = createConversationStorageAdapter({
      getItem: () => null,
      setItem,
      removeItem: () => undefined,
    } as any)

    expect(() => adapter.setItem('conversation-storage', JSON.stringify({ state: {} }))).not.toThrow()
    expect(setItem).toHaveBeenCalledTimes(2)
  })

  it('evicts by lastAccessAt instead of updatedAt under quota constraints', () => {
    const largeConversation = (id: string) => ({
      id,
      customer_id: 'user-1',
      status: 'active',
      mode: 'ai',
      message_count: 0,
      started_at: '',
      created_at: '',
      updated_at: '',
      payload: 'x'.repeat(1_400_000),
    })

    const result = pruneHistoryCachesForLimits(
      {
        'user-1': {
          items: [largeConversation('conv-old-access') as any],
          updatedAt: 10_000,
          lastAccessAt: 100,
          cursor: null,
        },
        'user-2': {
          items: [largeConversation('conv-new-access') as any],
          updatedAt: 1_000,
          lastAccessAt: 20_000,
          cursor: null,
        },
      },
      {},
      { currentUserId: 'user-1', conversations: [] }
    )

    expect(result.historyListCache['user-2']).toBeTruthy()
    expect(result.historyListCache['user-1']).toBeUndefined()
  })
})
