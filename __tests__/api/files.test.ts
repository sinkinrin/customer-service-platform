/**
 * Files API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/file-storage', () => ({
  uploadFile: vi.fn(),
  getFileMetadata: vi.fn(),
  getFilePath: vi.fn(),
  deleteFile: vi.fn(),
}))

const readFile = vi.hoisted(() => vi.fn())

vi.mock('fs', () => ({
  promises: {
    readFile,
  },
  default: {
    promises: {
      readFile,
    },
  },
}))

import { requireAuth } from '@/lib/utils/auth'
import { uploadFile, getFileMetadata, getFilePath, deleteFile } from '@/lib/file-storage'
import { promises as fs } from 'fs'

import { POST as POST_UPLOAD } from '@/app/api/files/upload/route'
import { GET as GET_FILE, DELETE as DELETE_FILE } from '@/app/api/files/[id]/route'
import { GET as GET_DOWNLOAD } from '@/app/api/files/[id]/download/route'

function createMockUploadRequest(payload: {
  file?: File
  reference_type?: string
  reference_id?: string | null
}): NextRequest {
  const formData = {
    get: (key: string) => {
      if (key === 'file') return payload.file ?? null
      if (key === 'reference_type') return payload.reference_type ?? null
      if (key === 'reference_id') return payload.reference_id ?? null
      return null
    },
  }

  return {
    formData: async () => formData,
  } as unknown as NextRequest
}

describe('Files API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user_1', role: 'customer' } as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/files/upload', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

      const response = await POST_UPLOAD(createMockUploadRequest({}))
      expect(response.status).toBe(401)
    })

    it('rejects oversized files', async () => {
      const file = {
        name: 'big.txt',
        size: 11 * 1024 * 1024,
        type: 'text/plain',
        arrayBuffer: vi.fn(),
      } as unknown as File

      const response = await POST_UPLOAD(
        createMockUploadRequest({
          file,
          reference_type: 'message',
          reference_id: '123e4567-e89b-12d3-a456-426614174000',
        })
      )

      expect(response.status).toBe(400)
    })

    it('uploads and returns file metadata', async () => {
      const file = {
        name: 'note.txt',
        size: 5,
        type: 'text/plain',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5)),
      } as unknown as File

      vi.mocked(uploadFile).mockResolvedValue({
        id: 'file_1',
        bucketName: 'message-attachments',
        filePath: 'message-attachments/file_1.txt',
        fileName: 'note.txt',
        fileSize: 5,
        mimeType: 'text/plain',
        url: '/api/files/file_1/download',
      })

      const response = await POST_UPLOAD(
        createMockUploadRequest({
          file,
          reference_type: 'message',
          reference_id: '123e4567-e89b-12d3-a456-426614174000',
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(201)
      expect(payload.success).toBe(true)
      expect(payload.data.id).toBe('file_1')
      expect(uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          bucketName: 'message-attachments',
          referenceType: 'message',
        })
      )
    })
  })

  describe('GET /api/files/[id]', () => {
    it('returns 404 when metadata missing', async () => {
      vi.mocked(getFileMetadata).mockResolvedValue(null)

      const response = await GET_FILE({} as any, { params: Promise.resolve({ id: 'missing' }) })
      expect(response.status).toBe(404)
    })

    it('returns file metadata', async () => {
      vi.mocked(getFileMetadata).mockResolvedValue({
        id: 'file_1',
        userId: 'user_1',
        fileName: 'note.txt',
        fileSize: 5,
        mimeType: 'text/plain',
        createdAt: new Date('2024-01-01'),
      } as any)

      const response = await GET_FILE({} as any, { params: Promise.resolve({ id: 'file_1' }) })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.file_name).toBe('note.txt')
    })
  })

  describe('DELETE /api/files/[id]', () => {
    it('returns 404 when delete fails', async () => {
      vi.mocked(deleteFile).mockResolvedValue(false)

      const response = await DELETE_FILE({} as any, { params: Promise.resolve({ id: 'file_1' }) })
      expect(response.status).toBe(404)
    })

    it('deletes file when authorized', async () => {
      vi.mocked(deleteFile).mockResolvedValue(true)

      const response = await DELETE_FILE({} as any, { params: Promise.resolve({ id: 'file_1' }) })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
    })
  })

  describe('GET /api/files/[id]/download', () => {
    it('returns 404 when file metadata missing', async () => {
      vi.mocked(getFileMetadata).mockResolvedValue(null)

      const response = await GET_DOWNLOAD({} as any, { params: Promise.resolve({ id: 'missing' }) })
      expect(response.status).toBe(404)
    })

    it('returns file content with headers', async () => {
      vi.mocked(getFileMetadata).mockResolvedValue({
        id: 'file_1',
        userId: 'user_1',
        fileName: 'note.txt',
        fileSize: 5,
        mimeType: 'text/plain',
      } as any)
      vi.mocked(getFilePath).mockResolvedValue('C:\\tmp\\note.txt')
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('hello'))

      const response = await GET_DOWNLOAD({} as any, { params: Promise.resolve({ id: 'file_1' }) })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/plain')
      expect(response.headers.get('Content-Disposition')).toContain('note.txt')
    })
  })
})
