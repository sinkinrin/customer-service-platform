import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/ai-conversation-service', () => ({
  getConversation: vi.fn(),
}))

import { requireAuth } from '@/lib/utils/auth'
import { getConversation } from '@/lib/ai-conversation-service'
import { POST } from '@/app/api/conversations/[id]/mark-read/route'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method: 'POST' })
}

describe('POST /api/conversations/[id]/mark-read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'cust_1',
      email: 'same@test.com',
      role: 'customer',
      full_name: 'Customer 1',
    } as any)
  })

  it('rejects access when customerId differs even if email is the same', async () => {
    vi.mocked(getConversation).mockResolvedValue({
      id: 'conv_1',
      customerId: 'cust_2',
      customerEmail: 'same@test.com',
    } as any)

    const response = await POST(createRequest('http://localhost:3000/api/conversations/conv_1/mark-read'), {
      params: Promise.resolve({ id: 'conv_1' }),
    })

    expect(response.status).toBe(404)
  })

  it('allows access when customerId matches even if email is different', async () => {
    vi.mocked(getConversation).mockResolvedValue({
      id: 'conv_1',
      customerId: 'cust_1',
      customerEmail: 'other@test.com',
    } as any)

    const response = await POST(createRequest('http://localhost:3000/api/conversations/conv_1/mark-read'), {
      params: Promise.resolve({ id: 'conv_1' }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(payload.data.conversation_id).toBe('conv_1')
  })

  it('rejects non-customer role when customerId differs', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'staff_1',
      email: 'staff@test.com',
      role: 'staff',
      full_name: 'Staff 1',
    } as any)
    vi.mocked(getConversation).mockResolvedValue({
      id: 'conv_1',
      customerId: 'cust_1',
      customerEmail: 'cust@test.com',
    } as any)

    const response = await POST(createRequest('http://localhost:3000/api/conversations/conv_1/mark-read'), {
      params: Promise.resolve({ id: 'conv_1' }),
    })

    expect(response.status).toBe(404)
  })
})
