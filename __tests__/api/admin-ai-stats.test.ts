/**
 * Admin AI Conversations Stats API Tests
 *
 * Tests:
 * 1. Returns 401 when user is not admin (Unauthorized)
 * 2. Returns 401 when user is not admin (Forbidden)
 * 3. Successfully returns dashboard stats when admin user
 * 4. Handles service errors gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/admin/stats/ai-conversations/route'

// Mock auth module
vi.mock('@/lib/utils/auth', () => ({
  requireRole: vi.fn(),
}))

// Mock AI conversation service
vi.mock('@/lib/ai-conversation-service', () => ({
  getAiConversationDashboardStats: vi.fn(),
}))

import { requireRole } from '@/lib/utils/auth'
import { getAiConversationDashboardStats } from '@/lib/ai-conversation-service'

// Mock stats data
const mockStats = {
  conversations: { total: 100, active: 15, closed: 85 },
  messages: { total: 500, customer: 250, ai: 250 },
  ratings: { positive: 80, negative: 20, satisfactionRate: 80 },
  recentNegative: [
    {
      messageId: 'msg_1',
      content: 'AI gave wrong answer...',
      feedback: 'Not accurate',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ],
}

describe('GET /api/admin/stats/ai-conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when user is not admin (Unauthorized)', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Unauthorized'))

    const response = await GET()

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 401 when user is not admin (Forbidden)', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))

    const response = await GET()

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return dashboard stats when admin user', async () => {
    vi.mocked(requireRole).mockResolvedValue(undefined as any)
    vi.mocked(getAiConversationDashboardStats).mockResolvedValue(mockStats)

    const response = await GET()

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockStats)
    expect(requireRole).toHaveBeenCalledWith(['admin'])
    expect(getAiConversationDashboardStats).toHaveBeenCalled()
  })

  it('should handle service errors gracefully', async () => {
    vi.mocked(requireRole).mockResolvedValue(undefined as any)
    vi.mocked(getAiConversationDashboardStats).mockRejectedValue(
      new Error('Database connection failed')
    )

    const response = await GET()

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('INTERNAL_ERROR')
    expect(data.error.message).toBe('Failed to fetch AI conversation statistics')
  })
})
