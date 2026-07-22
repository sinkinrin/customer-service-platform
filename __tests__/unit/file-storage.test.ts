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
    fsMocks.mkdir.mockResolvedValue(undefined)
    fsMocks.writeFile.mockResolvedValue(undefined)
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
})
