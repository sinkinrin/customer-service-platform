/**
 * Conversation detail APIs integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/ai-conversation-service', () => ({
  getConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getConversationMessages: vi.fn(),
  addMessage: vi.fn(),
}))

import { requireAuth } from '@/lib/utils/auth'
import {
  getConversation,
  updateConversation,
  deleteConversation,
  getConversationMessages,
  addMessage,
} from '@/lib/ai-conversation-service'

import { GET as GET_CONVERSATION, PUT as PUT_CONVERSATION, DELETE as DELETE_CONVERSATION } from '@/app/api/conversations/[id]/route'
import { GET as GET_MESSAGES, POST as POST_MESSAGES } from '@/app/api/conversations/[id]/messages/route'

const baseConversation = {
  id: 'conv_1',
  customerId: 'cust_1',
  customerEmail: 'customer@test.com',
  status: 'active',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  lastMessageAt: new Date('2024-01-01T00:00:00Z'),
}

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Conversation detail APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'cust_1',
      email: 'customer@test.com',
      full_name: 'Customer',
      role: 'customer',
    } as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/conversations/[id]', () => {
    it('returns 404 when conversation is missing', async () => {
      vi.mocked(getConversation).mockResolvedValue(null)

      const response = await GET_CONVERSATION(createRequest('http://localhost:3000/api/conversations/conv_1'), {
        params: Promise.resolve({ id: 'conv_1' }),
      })
      expect(response.status).toBe(404)
    })

    it('returns 404 when accessing another customer conversation', async () => {
      vi.mocked(getConversation).mockResolvedValue({
        ...baseConversation,
        customerEmail: 'other@test.com',
      } as any)

      const response = await GET_CONVERSATION(createRequest('http://localhost:3000/api/conversations/conv_1'), {
        params: Promise.resolve({ id: 'conv_1' }),
      })
      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/conversations/[id]', () => {
    it('validates update payload', async () => {
      vi.mocked(getConversation).mockResolvedValue(baseConversation as any)

      const request = createRequest('http://localhost:3000/api/conversations/conv_1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'invalid' }),
      })

      const response = await PUT_CONVERSATION(request, { params: Promise.resolve({ id: 'conv_1' }) })
      expect(response.status).toBe(400)
    })

    it('updates conversation status', async () => {
      vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
      vi.mocked(updateConversation).mockResolvedValue({
        ...baseConversation,
        status: 'closed',
      } as any)
      vi.mocked(getConversationMessages).mockResolvedValue([])

      const request = createRequest('http://localhost:3000/api/conversations/conv_1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'closed' }),
      })

      const response = await PUT_CONVERSATION(request, { params: Promise.resolve({ id: 'conv_1' }) })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.status).toBe('closed')
      expect(updateConversation).toHaveBeenCalledWith('conv_1', { status: 'closed' })
    })
  })

  describe('DELETE /api/conversations/[id]', () => {
    it('deletes conversation when owned by customer', async () => {
      vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
      vi.mocked(deleteConversation).mockResolvedValue(undefined)

      const response = await DELETE_CONVERSATION(createRequest('http://localhost:3000/api/conversations/conv_1'), {
        params: Promise.resolve({ id: 'conv_1' }),
      })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
    })
  })

  describe('GET /api/conversations/[id]/messages', () => {
    it('returns messages with sender names', async () => {
      vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
      vi.mocked(getConversationMessages).mockResolvedValue([
        {
          id: 'msg_1',
          senderId: 'ai',
          senderRole: 'ai',
          content: 'Hello',
          messageType: 'text',
          metadata: null,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          rating: null,
        },
      ] as any)

      const request = createRequest('http://localhost:3000/api/conversations/conv_1/messages?limit=10&offset=0')
      const response = await GET_MESSAGES(request, { params: Promise.resolve({ id: 'conv_1' }) })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.messages[0].sender.full_name).toBe('AI Assistant')
    })
  })

  describe('POST /api/conversations/[id]/messages', () => {
    it('validates message payload', async () => {
      vi.mocked(getConversation).mockResolvedValue(baseConversation as any)

      const request = createRequest('http://localhost:3000/api/conversations/conv_1/messages', {
        method: 'POST',
        body: JSON.stringify({ content: '' }),
      })

      const response = await POST_MESSAGES(request, { params: Promise.resolve({ id: 'conv_1' }) })
      expect(response.status).toBe(400)
    })

    it('stores AI messages when metadata role is ai', async () => {
      vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
      vi.mocked(addMessage).mockResolvedValue({
        id: 'msg_2',
        content: 'AI reply',
        createdAt: new Date('2024-01-01T01:00:00Z'),
      } as any)

      const request = createRequest('http://localhost:3000/api/conversations/conv_1/messages', {
        method: 'POST',
        body: JSON.stringify({
          content: 'AI reply',
          message_type: 'text',
          metadata: { role: 'ai' },
        }),
      })

      const response = await POST_MESSAGES(request, { params: Promise.resolve({ id: 'conv_1' }) })
      const payload = await response.json()

      expect(response.status).toBe(201)
      expect(payload.success).toBe(true)
      expect(payload.data.sender_role).toBe('ai')
    })
  })
})
