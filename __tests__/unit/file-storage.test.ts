import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('fs', () => ({
  promises: fsMocks,
  default: {
    promises: fsMocks,
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    uploadedFile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { getFilePath, uploadFile } from '@/lib/file-storage'

describe('file storage path containment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fsMocks.mkdir.mockReset().mockResolvedValue(undefined)
    fsMocks.writeFile.mockReset().mockResolvedValue(undefined)
    fsMocks.unlink.mockReset().mockResolvedValue(undefined)
    vi.mocked(prisma.uploadedFile.findUnique).mockReset().mockResolvedValue(null)
    vi.mocked(prisma.uploadedFile.create).mockReset()
  })

  it('resolves stored files inside the uploads directory', async () => {
    vi.mocked(prisma.uploadedFile.findUnique).mockResolvedValue({
      filePath: path.join('avatars', 'file.png'),
    } as any)

    const resolved = await getFilePath('file-1')
    const uploadRoot = path.resolve(process.cwd(), 'uploads')

    expect(resolved).toBe(path.resolve(uploadRoot, 'avatars', 'file.png'))
  })

  it('rejects stored paths that escape the uploads directory', async () => {
    vi.mocked(prisma.uploadedFile.findUnique).mockResolvedValue({
      filePath: path.join('..', 'outside.txt'),
    } as any)

    await expect(getFilePath('file-1')).rejects.toThrow('Invalid stored file path')
  })

  it('rejects an upload bucket that escapes the uploads directory', async () => {
    const file = {
      name: 'note.txt',
      size: 5,
      type: 'text/plain',
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5)),
    } as unknown as File

    await expect(
      uploadFile({
        file,
        userId: 'user-1',
        bucketName: path.join('..', 'outside'),
        referenceType: 'message',
      })
    ).rejects.toThrow('Invalid stored file path')

    expect(fsMocks.writeFile).not.toHaveBeenCalled()
    expect(prisma.uploadedFile.create).not.toHaveBeenCalled()
  })

  it('writes valid uploads inside the configured bucket', async () => {
    const file = {
      name: 'note.txt',
      size: 5,
      type: 'text/plain',
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('hello').buffer),
    } as unknown as File
    vi.mocked(prisma.uploadedFile.create).mockImplementation(async ({ data }) => ({
      ...data,
      createdAt: new Date('2026-07-22T00:00:00Z'),
    }) as any)

    const result = await uploadFile({
      file,
      userId: 'user-1',
      bucketName: 'message-attachments',
      referenceType: 'message',
    })

    expect(fsMocks.writeFile).toHaveBeenCalledTimes(1)
    const writtenPath = fsMocks.writeFile.mock.calls[0][0] as string
    expect(path.relative(path.resolve(process.cwd(), 'uploads'), writtenPath)).not.toMatch(/^\.\./)
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.url).toBe(`/api/files/${result.id}/download`)
  })

  it('keeps the written file and returns the confirmed record when create outcome is unknown', async () => {
    const file = {
      name: 'note.txt',
      size: 5,
      type: 'text/plain',
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('hello').buffer),
    } as unknown as File
    const createError = new Error('database response lost')
    let attemptedData: any
    vi.mocked(prisma.uploadedFile.create).mockImplementation(async ({ data }) => {
      attemptedData = data
      throw createError
    })
    vi.mocked(prisma.uploadedFile.findUnique).mockImplementation(async ({ where }) => ({
      ...attemptedData,
      id: where.id,
      createdAt: new Date('2026-07-22T00:00:00Z'),
    }) as any)

    const result = await uploadFile({
      file,
      userId: 'user-1',
      bucketName: 'message-attachments',
      referenceType: 'message',
    })

    expect(prisma.uploadedFile.findUnique).toHaveBeenCalledWith({
      where: { id: attemptedData.id },
    })
    expect(fsMocks.unlink).not.toHaveBeenCalled()
    expect(result.id).toBe(attemptedData.id)
  })

  it('removes the written file when metadata is confirmed absent', async () => {
    const file = {
      name: 'note.txt',
      size: 5,
      type: 'text/plain',
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('hello').buffer),
    } as unknown as File
    vi.mocked(prisma.uploadedFile.create).mockRejectedValue(new Error('database unavailable'))
    vi.mocked(prisma.uploadedFile.findUnique).mockResolvedValue(null)

    await expect(uploadFile({
      file,
      userId: 'user-1',
      bucketName: 'message-attachments',
      referenceType: 'message',
    })).rejects.toThrow('database unavailable')

    expect(fsMocks.unlink).toHaveBeenCalledWith(fsMocks.writeFile.mock.calls[0][0])
  })

  it('preserves the written file when metadata persistence cannot be confirmed', async () => {
    const file = {
      name: 'note.txt',
      size: 5,
      type: 'text/plain',
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('hello').buffer),
    } as unknown as File
    vi.mocked(prisma.uploadedFile.create).mockRejectedValue(new Error('database response lost'))
    vi.mocked(prisma.uploadedFile.findUnique).mockRejectedValue(new Error('database still unavailable'))

    await expect(uploadFile({
      file,
      userId: 'user-1',
      bucketName: 'message-attachments',
      referenceType: 'message',
    })).rejects.toThrow('database response lost')

    expect(fsMocks.unlink).not.toHaveBeenCalled()
  })
})
