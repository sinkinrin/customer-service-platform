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

// ============================================================================
// GET /api/faq/[id]
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = parseInt(params.id)

    if (isNaN(articleId)) {
      return errorResponse('Invalid article ID', 400)
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'zh-CN'

    // Get article from database
    const article = await prisma.faqArticle.findUnique({
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

    if (!article) {
      return errorResponse('Article not found', 404)
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

    return successResponse({
      item: {
        id: article.id,
        category_id: article.categoryId,
        title: translation?.title || '',
        content: translation?.content || '',
        keywords: translation ? JSON.parse(translation.keywords) : [],
        views: article.views + 1, // Return incremented value
        helpful: helpfulCount,
        not_helpful: notHelpfulCount,
        created_at: article.createdAt.toISOString(),
        updated_at: article.updatedAt.toISOString(),
      },
      language,
      source: 'database',
    })
  } catch (error) {
    console.error('GET /api/faq/[id] error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

