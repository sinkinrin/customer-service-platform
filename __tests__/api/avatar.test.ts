/**
 * User avatar API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/file-storage', () => ({
  uploadFile: vi.fn(),
}))

import { auth } from '@/auth'
import { uploadFile } from '@/lib/file-storage'

import { GET, POST, DELETE } from '@/app/api/user/avatar/route'

function createUploadRequest(file?: File): NextRequest {
  const formData = {
    get: (key: string) => (key === 'avatar' ? file ?? null : null),
  }

  return {
    formData: async () => formData,
  } as unknown as NextRequest
}

describe('User avatar API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/user/avatar', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('returns avatar url from session', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { avatar_url: '/avatars/u.png' } } as any)

      const response = await GET()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.avatarUrl).toBe('/avatars/u.png')
    })
  })

  describe('POST /api/user/avatar', () => {
    it('rejects invalid file type', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user_1' } } as any)

      const file = {
        name: 'note.txt',
        size: 5,
        type: 'text/plain',
      } as unknown as File

      const response = await POST(createUploadRequest(file))
      expect(response.status).toBe(400)
    })

    it('uploads avatar and returns public url', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user_1' } } as any)
      vi.mocked(uploadFile).mockResolvedValue({
        id: 'avatar_1',
        fileName: 'avatar.png',
        url: '/api/files/avatar_1/download',
      })

      const file = {
        name: 'avatar.png',
        size: 1024,
        type: 'image/png',
      } as unknown as File

      const response = await POST(createUploadRequest(file))
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.avatarUrl).toBe('/api/avatars/avatar_1')
      expect(payload.data.fileName).toBe('avatar.png')
    })
  })

  describe('DELETE /api/user/avatar', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await DELETE()
      expect(response.status).toBe(401)
    })

    it('returns success for delete', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user_1' } } as any)

      const response = await DELETE()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
    })
  })
})
