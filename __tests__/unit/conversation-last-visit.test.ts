import { describe, expect, it } from 'vitest'
import { getConversationLastVisitKey } from '@/lib/constants/conversation'

describe('conversation last visit key', () => {
  it('namespaces the last visit timestamp by user id', () => {
    expect(getConversationLastVisitKey('user-a')).toBe('conversationLastVisitAt:user-a')
    expect(getConversationLastVisitKey('user-b')).toBe('conversationLastVisitAt:user-b')
  })
})
