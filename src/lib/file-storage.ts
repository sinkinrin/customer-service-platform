/**
 * File Storage Service
 *
 * Handles file upload, storage, and retrieval using local filesystem
 * Stores files in the /uploads directory and metadata in the database
 */

import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

// Storage configuration
const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads')

// Ensure upload directories exist
async function ensureDirectories() {
  const buckets = ['message-attachments', 'avatars', 'ticket-attachments']

  try {
    await fs.mkdir(UPLOAD_BASE_DIR, { recursive: true })

    for (const bucket of buckets) {
      const bucketPath = path.join(UPLOAD_BASE_DIR, bucket)
      await fs.mkdir(bucketPath, { recursive: true })
    }
  } catch (error) {
    console.error('Error creating upload directories:', error)
    throw error
  }
}

// Initialize directories on module load
ensureDirectories().catch(console.error)

/**
 * Upload a file to storage
 */
export async function uploadFile(options: {
  file: File
  userId: string
  bucketName: string
  referenceType: string
  referenceId?: string
}): Promise<{
  id: string
  bucketName: string
  filePath: string
  fileName: string
  fileSize: number
  mimeType: string
  url: string
}> {
  const { file, userId, bucketName, referenceType, referenceId } = options

  // Generate unique file ID and path
  const fileId = randomUUID()
  const fileExt = file.name.split('.').pop() || 'bin'
  const fileName = `${fileId}.${fileExt}`
  const filePath = path.join(bucketName, fileName)
  const absoluteFilePath = path.join(UPLOAD_BASE_DIR, filePath)

  // Ensure bucket directory exists
  await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true })

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(absoluteFilePath, buffer)

  // Save metadata to database
  const fileRecord = await prisma.uploadedFile.create({
    data: {
      id: fileId,
      userId,
      bucketName,
      filePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      referenceType,
      referenceId: referenceId || null,
    },
  })

  // Return file info with public URL
  return {
    id: fileRecord.id,
    bucketName: fileRecord.bucketName,
    filePath: fileRecord.filePath,
    fileName: fileRecord.fileName,
    fileSize: fileRecord.fileSize,
    mimeType: fileRecord.mimeType,
    url: `/api/files/${fileId}/download`,
  }
}

/**
 * Get file metadata from database
 */
export async function getFileMetadata(fileId: string) {
  return await prisma.uploadedFile.findUnique({
    where: { id: fileId },
  })
}

/**
 * Get file path on disk
 */
export async function getFilePath(fileId: string): Promise<string | null> {
  const file = await getFileMetadata(fileId)
  if (!file) return null

  return path.join(UPLOAD_BASE_DIR, file.filePath)
}

/**
 * Delete a file from storage
 */
export async function deleteFile(fileId: string, userId?: string): Promise<boolean> {
  try {
    const file = await getFileMetadata(fileId)
    if (!file) return false

    // Optional: Check if user owns the file
    if (userId && file.userId !== userId) {
      throw new Error('Unauthorized to delete this file')
    }

    // Delete physical file
    const absoluteFilePath = path.join(UPLOAD_BASE_DIR, file.filePath)
    try {
      await fs.unlink(absoluteFilePath)
    } catch (error) {
      console.error('Error deleting file from disk:', error)
      // Continue to delete metadata even if file doesn't exist
    }

    // Delete metadata from database
    await prisma.uploadedFile.delete({
      where: { id: fileId },
    })

    return true
  } catch (error) {
    console.error('Error deleting file:', error)
    return false
  }
}

/**
 * Get files by reference
 */
export async function getFilesByReference(referenceType: string, referenceId: string) {
  return await prisma.uploadedFile.findMany({
    where: {
      referenceType,
      referenceId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Get files by user
 */
export async function getFilesByUser(userId: string) {
  return await prisma.uploadedFile.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
