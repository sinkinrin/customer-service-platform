/**
 * File Download API
 *
 * GET /api/files/[id]/download - Download a file
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/utils/api-response'
import { getFileMetadata, getFilePath } from '@/lib/file-storage'
import { promises as fs } from 'fs'

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    await requireAuth()

    // Get file metadata
    const file = await getFileMetadata(params.id)
    if (!file) {
      return notFoundResponse('File not found')
    }

    // Get file path
    const filePath = await getFilePath(params.id)
    if (!filePath) {
      return notFoundResponse('File not found')
    }

    // Read file from disk
    const fileBuffer = await fs.readFile(filePath)

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        'Content-Length': file.fileSize.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error.code === 'ENOENT') {
      return notFoundResponse('File not found on disk')
    }
    return serverErrorResponse('Failed to download file', error.message)
  }
}
