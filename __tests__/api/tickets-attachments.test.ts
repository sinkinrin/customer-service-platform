/**
 * Ticket attachment download API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from '@/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getArticle: vi.fn(),
    downloadAttachment: vi.fn(),
  },
}))

import { requireAuth } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'

describe('Ticket Attachment Download API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns 404 for invalid id parameters', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'cust_001',
      email: 'customer@test.com',
      role: 'customer',
    } as any)

    const response = await GET({} as any, {
      params: Promise.resolve({ id: 'bad', articleId: '1', attachmentId: '2' }),
    })

    expect(response.status).toBe(404)
  })

  it('downloads attachment for customer with X-On-Behalf-Of', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'cust_001',
      email: 'customer@test.com',
      role: 'customer',
    } as any)

    vi.mocked(zammadClient.getArticle).mockResolvedValue({
      id: 10,
      attachments: [{ id: 5, filename: 'report.txt' }],
    } as any)

    vi.mocked(zammadClient.downloadAttachment).mockResolvedValue({
      type: 'text/plain',
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('data')),
    } as any)

    const response = await GET({} as any, {
      params: Promise.resolve({ id: '1', articleId: '10', attachmentId: '5' }),
    })

    expect(response.status).toBe(200)
    expect(zammadClient.getArticle).toHaveBeenCalledWith(10, 'customer@test.com')
    expect(zammadClient.downloadAttachment).toHaveBeenCalledWith(1, 10, 5, 'customer@test.com')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
  })
})
