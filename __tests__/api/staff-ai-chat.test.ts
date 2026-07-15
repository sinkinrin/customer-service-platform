import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRequireRole, mockChat } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockChat: vi.fn(),
}))

vi.mock('@/lib/utils/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/lib/utils/ai-config', () => ({
  readAISettings: () => ({
    enabled: true,
    provider: 'fastgpt',
  }),
}))

vi.mock('@/lib/utils/api-logger', () => ({
  getApiLogger: () => ({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/ai/providers', () => ({
  aiProviders: {
    fastgpt: {
      chat: mockChat,
    },
  },
}))

import { POST } from '@/app/api/staff/ai/chat/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/staff/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('staff AI chat session isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue({ id: 'staff-1', role: 'staff' })
    mockChat.mockResolvedValue({
      success: true,
      data: { message: 'answer', model: 'test-model' },
    })
  })

  it('uses a stable upstream id for the same user and panel session', async () => {
    await POST(request({ message: 'first', sessionId: 'panel-session' }))
    await POST(request({ message: 'second', sessionId: 'panel-session' }))

    expect(mockChat).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ conversationId: 'staff-staff-1-panel-session' }),
      expect.any(Object)
    )
    expect(mockChat).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ conversationId: 'staff-staff-1-panel-session' }),
      expect.any(Object)
    )
  })

  it('isolates the same panel session id between staff users', async () => {
    await POST(request({ message: 'first', sessionId: 'shared-session' }))
    mockRequireRole.mockResolvedValue({ id: 'staff-2', role: 'staff' })
    await POST(request({ message: 'second', sessionId: 'shared-session' }))

    expect(mockChat.mock.calls[0][0].conversationId).toBe('staff-staff-1-shared-session')
    expect(mockChat.mock.calls[1][0].conversationId).toBe('staff-staff-2-shared-session')
  })

  it('rejects invalid session ids before calling the provider', async () => {
    const response = await POST(request({ message: 'hello', sessionId: 'invalid session id' }))

    expect(response.status).toBe(400)
    expect(mockChat).not.toHaveBeenCalled()
  })
})
