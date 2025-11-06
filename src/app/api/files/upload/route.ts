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

