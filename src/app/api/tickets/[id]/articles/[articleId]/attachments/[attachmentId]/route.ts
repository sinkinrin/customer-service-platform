/**
 * Ticket Article Attachment Download API
 *
 * GET /api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]
 * Download attachment from Zammad
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'
import {
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'

interface RouteParams {
  params: Promise<{
    id: string
    articleId: string
    attachmentId: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { id, articleId, attachmentId } = await params

    const ticketId = parseInt(id, 10)
    const artId = parseInt(articleId, 10)
    const attId = parseInt(attachmentId, 10)

    if (isNaN(ticketId) || isNaN(artId) || isNaN(attId)) {
      return notFoundResponse('Invalid ID parameters')
    }

    // Get article to find attachment filename
    // All roles use X-On-Behalf-Of for unified permission control via Zammad
    const article = await zammadClient.getArticle(artId, user.email)

    // Find the attachment metadata to get the filename
    const attachmentMeta = article.attachments?.find((att: { id: number }) => att.id === attId)
    const filename = attachmentMeta?.filename || `attachment-${attId}`

    // Download attachment from Zammad
    // All roles use X-On-Behalf-Of - Zammad validates user has access to this ticket
    const blob = await zammadClient.downloadAttachment(ticketId, artId, attId, user.email)

    // Get content type from blob or default to octet-stream
    const contentType = blob.type || 'application/octet-stream'

    // Convert blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer()

    // Encode filename for Content-Disposition header (handle non-ASCII characters)
    const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape)

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('[Attachment Download] Error:', error)
    
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return notFoundResponse('Attachment not found')
    }
    
    return serverErrorResponse('Failed to download attachment', error.message)
  }
}
