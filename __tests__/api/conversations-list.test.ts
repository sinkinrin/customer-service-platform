import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/ai-conversation-service', () => ({
  getCustomerConversations: vi.fn(),
  createAIConversation: vi.fn(),
  addMessage: vi.fn(),
}))

import { requireAuth } from '@/lib/utils/auth'
import { getCustomerConversations } from '@/lib/ai-conversation-service'
import { GET } from '@/app/api/conversations/route'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /api/conversations list query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'cust_1',
      email: 'customer@test.com',
      role: 'customer',
      full_name: 'Customer',
    } as any)
    vi.mocked(getCustomerConversations).mockResolvedValue([] as any)
  })

  it('passes status and pagination to the database service', async () => {
    const response = await GET(
      createRequest('http://localhost:3000/api/conversations?status=active&limit=5&offset=10')
    )

    expect(response.status).toBe(200)
    expect(getCustomerConversations).toHaveBeenCalledWith('cust_1', {
      status: 'active',
      limit: 5,
      offset: 10,
    })
  })
})
