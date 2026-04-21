import { beforeEach, describe, expect, it } from 'vitest'
import { useConversationStore } from '@/lib/stores/conversation-store'

describe('conversation store', () => {
  beforeEach(() => {
    useConversationStore.setState({
      conversations: [],
      activeConversation: null,
      messages: [],
      isLoadingConversations: false,
      isLoadingMessages: false,
      isSendingMessage: false,
      currentUserId: null,
    })
  })

  it('clears persisted conversation state when switching users', () => {
    const store = useConversationStore.getState()
    store.resetForUser('user-a')
    store.addConversation({
      id: 'conv-1',
      customer_id: 'user-a',
      status: 'active',
      mode: 'ai',
      message_count: 0,
      started_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as any)

    store.resetForUser('user-b')

    expect(useConversationStore.getState().currentUserId).toBe('user-b')
    expect(useConversationStore.getState().conversations).toEqual([])
  })
})
