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
import { logger } from '@/lib/utils/logger'

/**
 * Short-lived in-memory cache for getArticle results.
 * When a ticket article has N attachments, the browser fires N concurrent
 * requests — without this cache each one would call getArticle separately.
 * TTL is 60 s (plenty for concurrent image loads, short enough to stay fresh).
 */
const articleCache = new Map<number, { promise: Promise<any>; expiry: number }>()
const ARTICLE_CACHE_TTL = 60_000
const ARTICLE_CACHE_MAX = 50

async function getCachedArticle(articleId: number, email: string) {
  const now = Date.now()
  const cached = articleCache.get(articleId)
  if (cached && cached.expiry > now) {
    return cached.promise
  }

  const promise = zammadClient.getArticle(articleId, email).catch(err => {
    articleCache.delete(articleId)
    throw err
  })

  // Evict oldest entries if at capacity
  if (articleCache.size >= ARTICLE_CACHE_MAX) {
    const oldest = articleCache.keys().next().value!
    articleCache.delete(oldest)
  }

  articleCache.set(articleId, { promise, expiry: now + ARTICLE_CACHE_TTL })
  return promise
}

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

    // Get article to find attachment filename (cached to avoid N identical
    // calls when the browser loads N attachments from the same article)
    const article = await getCachedArticle(artId, user.email)

    // Find the attachment metadata to get the filename
    const attachmentMeta = article.attachments?.find((att: { id: number }) => att.id === attId)
    const filename = attachmentMeta?.filename || `attachment-${attId}`

    // Download attachment from Zammad
    // All roles use X-On-Behalf-Of - Zammad validates user has access to this ticket
    const blob = await zammadClient.downloadAttachment(ticketId, artId, attId, user.email)

    // Prefer Zammad's stored MIME metadata (most authoritative),
    // then blob.type from the HTTP response, then fallback
    const contentType = attachmentMeta?.preferences?.['Content-Type']
      || attachmentMeta?.preferences?.['Mime-Type']
      || blob.type
      || 'application/octet-stream'

    // Convert blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer()

    // Encode filename for Content-Disposition header (handle non-ASCII characters)
    const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape)

    // Support ?inline=true for image/video preview in browser
    const wantsInline = _request.url
      ? new URL(_request.url).searchParams.get('inline') === 'true'
      : false
    const isInlineableType = contentType.startsWith('image/') || contentType.startsWith('video/')
    const disposition = (wantsInline && isInlineableType)
      ? `inline; filename*=UTF-8''${encodedFilename}`
      : `attachment; filename*=UTF-8''${encodedFilename}`

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    logger.error('Attachments', 'Failed to download attachment', { data: { error: error instanceof Error ? error.message : error } })

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }

    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return notFoundResponse('Attachment not found')
    }

    return serverErrorResponse('Failed to download attachment', error.message)
  }
}
