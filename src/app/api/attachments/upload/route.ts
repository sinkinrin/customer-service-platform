/**
 * Attachment Upload API
 *
 * POST /api/attachments/upload - Upload file to Zammad using upload_caches API
 *
 * Uses X-On-Behalf-Of for all roles to ensure proper ownership and
 * let Zammad handle permission validation.
 *
 * Security measures:
 * - File size validation
 * - MIME type validation (both client-claimed and magic byte detection)
 * - Filename sanitization to prevent path traversal and XSS
 *
 * Zammad uses the upload_caches endpoint to temporarily store files before
 * they are associated with tickets/articles. Files are grouped by form_id.
 */

import { NextRequest } from 'next/server'
import { fileTypeFromBuffer } from 'file-type'
import { requireAuth } from '@/lib/utils/auth'
import { getApiLogger } from '@/lib/utils/api-logger'
import {
  successResponse,
  validationErrorResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import {
  ATTACHMENT_LIMITS,
  ALLOWED_MIME_TYPES,
  formatFileSize,
  sanitizeFilename,
} from '@/lib/constants/attachments'

export async function POST(request: NextRequest) {
  const log = getApiLogger('AttachmentUploadAPI', request)
  try {
    const user = await requireAuth()

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    // Optional form_id to group multiple uploads together
    const formId = formData.get('form_id') as string | null

    if (!file) {
      log.warning('Validation failed: missing file')
      return validationErrorResponse({ file: 'File is required' })
    }

    // Validate file size
    if (file.size > ATTACHMENT_LIMITS.MAX_SIZE) {
      log.warning('Validation failed: file too large', {
        size: file.size,
        maxSize: ATTACHMENT_LIMITS.MAX_SIZE,
      })
      return validationErrorResponse({
        file: `File size exceeds limit. Maximum allowed: ${formatFileSize(ATTACHMENT_LIMITS.MAX_SIZE)}`,
      })
    }

    // Convert File to Buffer for validation and upload
    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate MIME type using magic bytes (actual file content)
    // This prevents MIME type spoofing attacks
    const detectedType = await fileTypeFromBuffer(buffer)

    // For text files, file-type returns undefined - use client-claimed type
    const effectiveMimeType = detectedType?.mime || file.type

    // Check if the effective MIME type is allowed
    if (!ALLOWED_MIME_TYPES.includes(effectiveMimeType)) {
      log.warning('Validation failed: file type not allowed', {
        detectedMime: detectedType?.mime,
        claimedMime: file.type,
        effectiveMime: effectiveMimeType,
      })
      return validationErrorResponse({
        file: `File type not allowed. Detected: ${effectiveMimeType}. Allowed types: images, documents, archives, videos.`,
      })
    }

    // Additional check: if file-type detected a type, ensure it's consistent
    // This catches cases where someone renames malicious.exe to malicious.pdf
    if (detectedType && !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
      log.warning('Validation failed: detected file type not allowed', {
        detectedMime: detectedType.mime,
        claimedMime: file.type,
      })
      return validationErrorResponse({
        file: `File content does not match a valid file type. Detected: ${detectedType.mime}`,
      })
    }

    // Sanitize filename to prevent path traversal and XSS attacks
    const safeFilename = sanitizeFilename(file.name)

    // Upload to Zammad using upload_caches API
    // All roles use X-On-Behalf-Of for unified permission control
    const result = await zammadClient.uploadAttachment(
      buffer,
      safeFilename,
      effectiveMimeType,
      user.email,
      formId || undefined  // Pass form_id if provided
    )

    log.info('Attachment uploaded', {
      userId: user.id,
      size: file.size,
      detectedMime: detectedType?.mime,
      claimedMime: file.type,
      effectiveMime: effectiveMimeType,
      formId: result.form_id,
      storeId: result.store_id,
      filename: safeFilename,
    })

    return successResponse({
      id: result.id,
      store_id: result.store_id,
      form_id: result.form_id,
      filename: safeFilename,
      size: file.size,
      mimeType: effectiveMimeType,
    })
  } catch (error) {
    log.error('Attachment upload failed', {
      error: error instanceof Error ? error.message : error,
    })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }

    return serverErrorResponse('Failed to upload attachment')
  }
}
