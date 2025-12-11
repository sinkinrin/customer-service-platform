/**
 * File Upload API
 * 
 * POST /api/files/upload - Upload a file to Supabase Storage
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { FileUploadSchema } from '@/types/api.types'

const BUCKET_MAP = {
  message: process.env.STORAGE_BUCKET_MESSAGE_ATTACHMENTS || 'message-attachments',
  user_profile: process.env.STORAGE_BUCKET_AVATARS || 'avatars',
  ticket: process.env.STORAGE_BUCKET_TICKET_ATTACHMENTS || 'ticket-attachments',
}

// P2 Fix: Server-side file validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Archives (optional, can be removed for security)
  'application/zip',
]

// TODO: Replace with real file storage when implemented
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const reference_type = formData.get('reference_type') as string
    const reference_id = formData.get('reference_id') as string | null

    if (!file) {
      return validationErrorResponse({ file: 'File is required' })
    }

    // P2 Fix: Validate file size on server
    if (file.size > MAX_FILE_SIZE) {
      return validationErrorResponse({ 
        file: `File size exceeds limit. Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      })
    }

    // P2 Fix: Validate MIME type on server
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return validationErrorResponse({ 
        file: `File type not allowed. Allowed types: images, PDF, Word, Excel, text files` 
      })
    }

    // Validate reference_type
    const validation = FileUploadSchema.safeParse({
      reference_type,
      reference_id: reference_id || undefined,
    })

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    // Get bucket name
    const bucketName = BUCKET_MAP[validation.data.reference_type]

    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // TODO: Replace with real file storage
    // For now, return mock file URL
    const mockFileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const mockPublicUrl = `/uploads/${bucketName}/${fileName}`

    return successResponse(
      {
        id: mockFileId,
        bucket_name: bucketName,
        file_path: fileName,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        url: mockPublicUrl,
        file_url: mockPublicUrl, // P1 Fix: Add file_url for client compatibility
      },
      201
    )
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to upload file', error.message)
  }
}

