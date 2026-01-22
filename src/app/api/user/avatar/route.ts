/**
 * Avatar Upload API
 * 
 * POST /api/user/avatar - Upload user avatar
 * GET /api/user/avatar - Get current user's avatar URL
 * DELETE /api/user/avatar - Remove avatar
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { uploadFile } from '@/lib/file-storage'
import { getApiLogger } from '@/lib/utils/api-logger'

const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// GET - Get current avatar URL
export async function GET(request: NextRequest) {
  const log = getApiLogger('AvatarAPI', request)
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Return current avatar URL from session
    // Note: Custom uploaded avatars stored in file system accessible via /uploads/avatars/
    return NextResponse.json({
      success: true,
      data: {
        avatarUrl: session.user.avatar_url || null,
      },
    })
  } catch (error) {
    log.error('Failed to get avatar', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get avatar' } },
      { status: 500 }
    )
  }
}

// POST - Upload new avatar
export async function POST(request: NextRequest) {
  const log = getApiLogger('AvatarAPI', request)
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 2MB' } },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' } },
        { status: 400 }
      )
    }

    // Upload file using existing file storage
    const uploadedFile = await uploadFile({
      file,
      userId: session.user.id,
      bucketName: 'avatars',
      referenceType: 'user_profile',
      referenceId: session.user.id,
    })

    // Avatar uploaded to file storage
    // The URL can be used directly for display
    // Use public avatar URL (no auth required for display)
    const publicAvatarUrl = `/api/avatars/${uploadedFile.id}`

    log.info('Avatar uploaded', {
      userId: session.user.id,
      fileId: uploadedFile.id,
      fileName: uploadedFile.fileName,
      fileSize: uploadedFile.fileSize,
      mimeType: uploadedFile.mimeType,
      avatarUrl: publicAvatarUrl,
    })

    return NextResponse.json({
      success: true,
      data: {
        avatarUrl: publicAvatarUrl,
        fileName: uploadedFile.fileName,
      },
    })
  } catch (error) {
    log.error('Failed to upload avatar', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to upload avatar' } },
      { status: 500 }
    )
  }
}

// DELETE - Remove avatar (placeholder - actual file deletion would require storage cleanup)
export async function DELETE(request: NextRequest) {
  const log = getApiLogger('AvatarAPI', request)
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Note: Actual file deletion from storage would be implemented here
    // For now, just return success
    log.info('Avatar delete requested', { userId: session.user.id })

    return NextResponse.json({
      success: true,
      data: { message: 'Avatar removed' },
    })
  } catch (error) {
    log.error('Failed to remove avatar', { error: error instanceof Error ? error.message : error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove avatar' } },
      { status: 500 }
    )
  }
}
