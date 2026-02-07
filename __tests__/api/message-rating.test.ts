/**
 * Message Rating API integration tests
 *
 * PUT /api/conversations/[id]/messages/[messageId]/rating
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/ai-conversation-service', () => ({
  getConversation: vi.fn(),
  rateMessage: vi.fn(),
  verifyMessageOwnership: vi.fn(),
}))

import { requireAuth } from '@/lib/utils/auth'
import {
  getConversation,
  rateMessage,
  verifyMessageOwnership,
} from '@/lib/ai-conversation-service'

import { PUT } from '@/app/api/conversations/[id]/messages/[messageId]/rating/route'

const baseConversation = {
  id: 'conv_1',
  customerId: 'cust_1',
  customerEmail: 'customer@test.com',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastMessageAt: new Date(),
}

const mockUser = {
  id: 'cust_1',
  email: 'customer@test.com',
  full_name: 'Customer',
  role: 'customer',
}

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('PUT /api/conversations/[id]/messages/[messageId]/rating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(mockUser as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'positive' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 when conversation not found', async () => {
    vi.mocked(getConversation).mockResolvedValue(null)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'positive' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(payload.error.message).toBe('Conversation not found')
  })

  it('returns 404 when conversation belongs to another user', async () => {
    vi.mocked(getConversation).mockResolvedValue({
      ...baseConversation,
      customerEmail: 'other@test.com',
    } as any)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'positive' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(payload.error.message).toBe('Conversation not found')
  })

  it('returns 404 when message does not belong to the conversation', async () => {
    vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
    vi.mocked(verifyMessageOwnership).mockResolvedValue(false)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'positive' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(payload.error.message).toBe('Message not found')
    expect(verifyMessageOwnership).toHaveBeenCalledWith('msg_1', 'conv_1')
  })

  it('returns 400 for invalid rating value', async () => {
    vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
    vi.mocked(verifyMessageOwnership).mockResolvedValue(true)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'invalid' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('successfully submits positive rating', async () => {
    vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
    vi.mocked(verifyMessageOwnership).mockResolvedValue(true)
    vi.mocked(rateMessage).mockResolvedValue({
      id: 'rating_1',
      messageId: 'msg_1',
      userId: 'cust_1',
      rating: 'positive',
      feedback: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'positive' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.rating).toBe('positive')
    expect(payload.data.feedback).toBeNull()
    expect(rateMessage).toHaveBeenCalledWith('msg_1', 'cust_1', 'positive', undefined)
  })

  it('successfully submits negative rating with feedback', async () => {
    vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
    vi.mocked(verifyMessageOwnership).mockResolvedValue(true)
    vi.mocked(rateMessage).mockResolvedValue({
      id: 'rating_1',
      messageId: 'msg_1',
      userId: 'cust_1',
      rating: 'negative',
      feedback: 'Not helpful',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'negative', feedback: 'Not helpful' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.rating).toBe('negative')
    expect(payload.data.feedback).toBe('Not helpful')
    expect(rateMessage).toHaveBeenCalledWith('msg_1', 'cust_1', 'negative', 'Not helpful')
  })

  it('successfully removes rating when rating is null', async () => {
    vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
    vi.mocked(verifyMessageOwnership).mockResolvedValue(true)
    vi.mocked(rateMessage).mockResolvedValue(null)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: null }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toBeNull()
    expect(rateMessage).toHaveBeenCalledWith('msg_1', 'cust_1', null, undefined)
  })

  it('feedback is optional for negative ratings', async () => {
    vi.mocked(getConversation).mockResolvedValue(baseConversation as any)
    vi.mocked(verifyMessageOwnership).mockResolvedValue(true)
    vi.mocked(rateMessage).mockResolvedValue({
      id: 'rating_1',
      messageId: 'msg_1',
      userId: 'cust_1',
      rating: 'negative',
      feedback: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = createRequest(
      'http://localhost:3000/api/conversations/conv_1/messages/msg_1/rating',
      {
        method: 'PUT',
        body: JSON.stringify({ rating: 'negative' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'conv_1', messageId: 'msg_1' }),
    })

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.rating).toBe('negative')
    expect(rateMessage).toHaveBeenCalledWith('msg_1', 'cust_1', 'negative', undefined)
  })
})
