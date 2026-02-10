/**
 * FAQ Article Detail API
 *
 * GET /api/faq/[id] - Get FAQ article by ID from database
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/utils/logger'

// ============================================================================
// GET /api/faq/[id]
// ============================================================================

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const articleId = parseInt(params.id)

    if (isNaN(articleId)) {
      return errorResponse('INVALID_ID', 'Invalid article ID', undefined, 400)
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'en'

    // Get article from database
    // FIX: Use findFirst instead of findUnique to avoid Prisma error with non-unique field isActive
    const article = await prisma.faqArticle.findFirst({
      where: {
        id: articleId,
        isActive: true,
      },
      include: {
        translations: {
          where: {
            locale: language,
          },
        },
      },
    })

    // Return 404 if article not found or not active (as per OpenSpec requirement)
    if (!article) {
      return errorResponse('NOT_FOUND', 'Article not found or not available', undefined, 404)
    }

    // Increment view count
    await prisma.faqArticle.update({
      where: { id: articleId },
      data: {
        views: {
          increment: 1,
        },
      },
    })

    // Get rating counts
    const helpfulCount = await prisma.faqRating.count({
      where: {
        articleId: article.id,
        isHelpful: true,
      },
    })

    const notHelpfulCount = await prisma.faqRating.count({
      where: {
        articleId: article.id,
        isHelpful: false,
      },
    })

    const translation = article.translations[0]

    // Get category name (FaqCategory doesn't have translations, just a name field)
    const category = await prisma.faqCategory.findUnique({
      where: { id: article.categoryId },
    })

    return successResponse({
      item: {
        id: article.id.toString(), // Frontend expects string ID
        category_id: article.categoryId.toString(), // Frontend expects string category_id
        category_name: category?.name || `Category ${article.categoryId}`, // Frontend expects category_name
        question: translation?.title || '', // Frontend expects 'question' field
        answer: translation?.content || '', // Frontend expects 'answer' field
        language: language, // Frontend expects language field
        keywords: translation ? JSON.parse(translation.keywords) : [],
        view_count: article.views + 1, // Return incremented value (frontend expects 'view_count')
        helpful_count: helpfulCount, // Frontend expects 'helpful_count'
        not_helpful_count: notHelpfulCount, // Frontend expects 'not_helpful_count'
        created_at: article.createdAt.toISOString(),
        updated_at: article.updatedAt.toISOString(),
      },
      language,
      source: 'database',
    })
  } catch (error) {
    logger.error('FAQ', 'Failed to fetch FAQ article by ID', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

