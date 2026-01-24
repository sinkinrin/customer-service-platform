/**
 * Public Avatar Download API
 * 
 * GET /api/avatars/[id] - Get avatar image (public, no auth required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFileMetadata, getFilePath } from '@/lib/file-storage'
import { promises as fs } from 'fs'
import { logger } from '@/lib/utils/logger'

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    // Get file metadata
    const file = await getFileMetadata(params.id)
    if (!file || file.bucketName !== 'avatars') {
      return new NextResponse('Not found', { status: 404 })
    }

    // Get file path
    const filePath = await getFilePath(params.id)
    if (!filePath) {
      return new NextResponse('Not found', { status: 404 })
    }

    // Read file from disk
    const fileBuffer = await fs.readFile(filePath)

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': file.fileSize.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    })
  } catch (error: any) {
    logger.error('Avatars', 'Failed to get avatar', { data: { error: error instanceof Error ? error.message : error } })
    if (error.code === 'ENOENT') {
      return new NextResponse('Not found', { status: 404 })
    }
    return new NextResponse('Internal error', { status: 500 })
  }
}
