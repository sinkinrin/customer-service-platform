/**
 * Customer journey scenarios
 *
 * These scenarios exercise real storage utilities instead of synthetic data checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('Customer journey: AI conversation', () => {
  const customer = {
    id: 'cust_001',
    email: 'zhang.san@example.com',
    region: 'asia-pacific',
    role: 'customer' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([]))
  })

  it('creates a new AI conversation for the customer', async () => {
    const { createAIConversation } = await import('@/lib/local-conversation-storage')

    const conversation = await createAIConversation(
      customer.id,
      customer.email
    )

    expect(conversation.mode).toBe('ai')
    expect(conversation.status).toBe('active')
    expect(conversation.customer_id).toBe(customer.id)
  })

  it('persists multiple customer messages without loss', async () => {
    const messages: any[] = []

    vi.mocked(fs.readFile).mockImplementation(async () => JSON.stringify(messages))
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      const parsed = JSON.parse(data as string)
      messages.length = 0
      messages.push(...parsed)
    })

    const { addMessage } = await import('@/lib/local-conversation-storage')

    await addMessage('conv_001', 'customer', customer.id, 'First message')
    await addMessage('conv_001', 'customer', customer.id, 'Second message')
    await addMessage('conv_001', 'customer', customer.id, 'Third message')

    expect(messages.length).toBe(3)
    expect(messages[0].content).toBe('First message')
  })

  it('closes a conversation by updating status', async () => {
    const conversations = [{
      id: 'conv_001',
      customer_id: customer.id,
      customer_email: customer.email,
      mode: 'ai',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    }]

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(conversations))

    const { updateConversation } = await import('@/lib/local-conversation-storage')

    const updated = await updateConversation('conv_001', {
      status: 'closed',
    })

    expect(updated?.mode).toBe('ai')
    expect(updated?.status).toBe('closed')
  })

  it('preserves AI history when retrieving conversation messages', async () => {
    const messages = [
      { id: 'msg_1', conversation_id: 'conv_001', sender_role: 'customer', content: 'Refund request' },
      { id: 'msg_2', conversation_id: 'conv_001', sender_role: 'ai', content: 'Need more info' },
      { id: 'msg_3', conversation_id: 'conv_001', sender_role: 'customer', content: 'Product issue' },
    ]

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(messages))

    const { getConversationMessages } = await import('@/lib/local-conversation-storage')

    const history = await getConversationMessages('conv_001')

    expect(history.length).toBe(3)
    expect(history[1].sender_role).toBe('ai')
  })

  // Human handoff, assignment, and rating flows were removed from local storage.
})
