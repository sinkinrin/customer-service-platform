/**
 * FAQ Article Rating API
 *
 * POST /api/faq/[id]/rating - Submit rating for FAQ article
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'

// ============================================================================
// POST /api/faq/[id]/rating
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const user = await requireAuth()

    const articleId = parseInt(params.id)

    if (isNaN(articleId)) {
      return errorResponse('Invalid article ID', 400)
    }

    // Parse request body
    const body = await request.json()
    const { is_helpful } = body

    if (typeof is_helpful !== 'boolean') {
      return errorResponse('is_helpful must be a boolean', 400)
    }

    // Check if article exists
    const article = await prisma.faqArticle.findUnique({
      where: {
        id: articleId,
        isActive: true,
      },
    })

    if (!article) {
      return errorResponse('Article not found', 404)
    }

    // Check if user has already rated this article
    const existingRating = await prisma.faqRating.findUnique({
      where: {
        articleId_userId: {
          articleId,
          userId: user.id,
        },
      },
    })

    if (existingRating) {
      // Update existing rating
      await prisma.faqRating.update({
        where: {
          articleId_userId: {
            articleId,
            userId: user.id,
          },
        },
        data: {
          isHelpful: is_helpful,
        },
      })

      return successResponse({
        message: 'Rating updated successfully',
        rating: {
          article_id: articleId,
          user_id: user.id,
          is_helpful,
        },
      })
    } else {
      // Create new rating
      await prisma.faqRating.create({
        data: {
          articleId,
          userId: user.id,
          isHelpful: is_helpful,
        },
      })

      return successResponse(
        {
          message: 'Rating submitted successfully',
          rating: {
            article_id: articleId,
            user_id: user.id,
            is_helpful,
          },
        },
        201
      )
    }
  } catch (error: any) {
    console.error('POST /api/faq/[id]/rating error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

