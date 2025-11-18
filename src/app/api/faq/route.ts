/**
 * FAQ API
 *
 * GET /api/faq - Search FAQ items from database
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'

// ============================================================================
// GET /api/faq
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const language = searchParams.get('language') || 'zh-CN'
    // Support both camelCase (categoryId) and snake_case (category_id) for backwards compatibility
    const categoryId = searchParams.get('categoryId') || searchParams.get('category_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Validate limit (allow up to 1000 for admin pages)
    if (limit < 1 || limit > 1000) {
      return errorResponse('INVALID_LIMIT', 'Limit must be between 1 and 1000', undefined, 400)
    }

    // Build where clause
    const where: any = {
      isActive: true,
    }

    // Filter by category if provided
    if (categoryId) {
      where.categoryId = parseInt(categoryId)
    }

    // Get articles from database
    const articles = await prisma.faqArticle.findMany({
      where,
      include: {
        translations: {
          where: {
            locale: language,
          },
        },
        _count: {
          select: {
            ratings: {
              where: {
                isHelpful: true,
              },
            },
          },
        },
      },
      orderBy: {
        views: 'desc',
      },
      take: limit,
    })

    // Filter by search query if provided
    let filteredArticles = articles
    if (query) {
      const lowerQuery = query.toLowerCase()
      filteredArticles = articles.filter((article) => {
        const translation = article.translations[0]
        if (!translation) return false

        const titleMatch = translation.title.toLowerCase().includes(lowerQuery)
        const contentMatch = translation.content.toLowerCase().includes(lowerQuery)
        const keywordsMatch = JSON.parse(translation.keywords).some((kw: string) =>
          kw.toLowerCase().includes(lowerQuery)
        )

        return titleMatch || contentMatch || keywordsMatch
      })
    }

    // Get rating counts and category names
    const articlesWithRatings = await Promise.all(
      filteredArticles.map(async (article) => {
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

        // Get category name
        const category = await prisma.faqCategory.findUnique({
          where: { id: article.categoryId },
        })

        const translation = article.translations[0]

        return {
          id: article.id.toString(), // Frontend expects string ID
          question: translation?.title || '', // Frontend expects 'question' field
          answer: translation?.content || '', // Frontend expects 'answer' field
          category_id: article.categoryId.toString(), // Frontend expects string category_id
          category_name: category?.name || `Category ${article.categoryId}`, // Frontend expects category_name
          language: language, // Frontend expects language field
          keywords: translation ? JSON.parse(translation.keywords) : [],
          view_count: article.views, // Frontend expects 'view_count'
          helpful_count: helpfulCount, // Frontend expects 'helpful_count'
          not_helpful_count: notHelpfulCount, // Frontend expects 'not_helpful_count'
          created_at: article.createdAt.toISOString(),
          updated_at: article.updatedAt.toISOString(),
        }
      })
    )

    return successResponse({
      items: articlesWithRatings,
      total: articlesWithRatings.length,
      query,
      language,
      source: 'database',
    })
  } catch (error) {
    console.error('GET /api/faq error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

