import { describe, expect, it } from 'vitest'
import {
  INITIAL_AI_MESSAGES_LIMIT,
  getConversationAiChatModeKey,
  getConversationLastVisitKey,
} from '@/lib/constants/conversation'

describe('conversation last visit key', () => {
  it('namespaces the last visit timestamp by user id', () => {
    expect(getConversationLastVisitKey('user-a')).toBe('conversationLastVisitAt:user-a')
    expect(getConversationLastVisitKey('user-b')).toBe('conversationLastVisitAt:user-b')
  })

  it('namespaces the AI chat mode by user id', () => {
    expect(getConversationAiChatModeKey('user-a')).toBe('conversationAiChatMode:user-a')
    expect(getConversationAiChatModeKey('user-b')).toBe('conversationAiChatMode:user-b')
    expect(getConversationAiChatModeKey()).toBe('conversationAiChatMode:anonymous')
  })

  it('limits initial AI message loading to the recent thread window', () => {
    expect(INITIAL_AI_MESSAGES_LIMIT).toBe(100)
  })
})
