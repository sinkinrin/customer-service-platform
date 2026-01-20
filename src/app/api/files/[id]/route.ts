/**
 * File Management API
 *
 * @swagger
 * /api/files/{id}:
 *   get:
 *     description: Get file metadata and download URL
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File metadata
 *       404:
 *         description: File not found
 *   delete:
 *     description: Delete a file
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { getFileMetadata, deleteFile } from '@/lib/file-storage'

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    await requireAuth()

    const file = await getFileMetadata(params.id)

    if (!file) {
      return notFoundResponse('File not found')
    }

    return successResponse({
      id: file.id,
      file_name: file.fileName,
      file_size: file.fileSize,
      mime_type: file.mimeType,
      url: `/api/files/${file.id}/download`,
      created_at: file.createdAt.toISOString(),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to get file', error.message)
  }
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const user = await requireAuth()

    const success = await deleteFile(params.id, user.id)

    if (!success) {
      return notFoundResponse('File not found or unauthorized')
    }

    return successResponse({ message: 'File deleted successfully' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to delete file', error.message)
  }
}

